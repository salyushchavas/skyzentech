package com.skyzen.careers.integration.webex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.skyzen.careers.integration.meeting.MeetingProvider;
import com.skyzen.careers.integration.meeting.MeetingRequest;
import com.skyzen.careers.integration.meeting.MeetingResponse;
import com.skyzen.careers.security.PiiEncryptionService;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.locks.ReentrantLock;

/**
 * WebEx Service App integration. Mirrors the public surface of
 * {@link com.skyzen.careers.integration.zoom.ZoomService} via the shared
 * {@link MeetingProvider} interface, so consumers can be migrated without
 * provider-specific branches.
 *
 * <h2>Token model — different from Zoom</h2>
 * Zoom's Server-to-Server grant ({@code grant_type=account_credentials}) is
 * stateless re-auth: every refresh fetches a fresh access token from
 * {@code accountId+clientId+clientSecret}, no refresh token in the picture.
 *
 * <p>WebEx Service Apps issue a token PAIR via {@code
 * grant_type=client_credentials}: an access token (~14d) AND a refresh token
 * (~90d). The refresh token is REQUIRED for subsequent access-token fetches
 * ({@code grant_type=refresh_token}), and each refresh returns a NEW refresh
 * token whose 90-day window resets. The current refresh token therefore MUST
 * be persisted across process restarts — losing it means the integration is
 * dead until an operator re-seeds via Control Hub. We store the pair in the
 * singleton {@link WebexCredentials} row, both fields encrypted via
 * {@link PiiEncryptionService}.</p>
 *
 * <h2>Bootstrap</h2>
 * On startup, if the DB row is missing OR the {@code WEBEX_REFRESH_TOKEN}
 * env variable is set AND differs from the persisted value, we (re-)seed the
 * row from the env variable. This is the manual rotation path: operator
 * obtains a fresh pair from the Service App's authorization flow, sets
 * {@code WEBEX_REFRESH_TOKEN} on Railway, restarts → the seeder updates the
 * row. Subsequent refreshes rotate normally and the env value is ignored
 * (the persisted value is the source of truth in steady state).
 *
 * <h2>Boot semantics</h2>
 * Soft-configured. Integration is considered {@link #isReady()} when client
 * credentials + org id are present AND the kill-switch hasn't been flipped to
 * {@code false}. When not ready, every meeting CRUD call throws
 * {@link IllegalStateException}.
 *
 * <h2>Per-host email</h2>
 * WebEx requires {@code hostEmail} on the meeting body to schedule on behalf
 * of a specific licensed user. We map {@link MeetingRequest#hostEmail()}
 * straight through. The host must be a licensed user on the WebEx org.
 */
@Service
@Slf4j
public class WebexService implements MeetingProvider {

    private static final String PROVIDER_NAME = "webex";
    private static final String API_BASE = "https://webexapis.com/v1";
    private static final String TOKEN_URL = API_BASE + "/access_token";
    private static final Duration REFRESH_WINDOW = Duration.ofMinutes(5);

    private final String clientId;
    private final String clientSecret;
    private final String serviceAppId;
    private final String orgId;
    private final String seedRefreshToken;
    private final String defaultHostEmail;
    private final Integer sessionTypeId;
    @Getter
    private final boolean enabled;

    private final WebexCredentialsRepository credentialsRepository;
    private final PiiEncryptionService piiEncryption;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ReentrantLock refreshLock = new ReentrantLock();

    /** In-memory cache to avoid hitting the DB on every API call within a hot loop. */
    private volatile String cachedAccessToken;
    private volatile Instant cachedAccessExpiresAt;

    @Getter private volatile String authenticatedDisplayName;
    @Getter private volatile String authenticatedEmail;
    @Getter private volatile String lastProbeError;
    @Getter private volatile Instant refreshTokenExpiresAt;

    public WebexService(
            @Value("${webex.client-id:}") String clientId,
            @Value("${webex.client-secret:}") String clientSecret,
            @Value("${webex.service-app-id:}") String serviceAppId,
            @Value("${webex.org-id:}") String orgId,
            @Value("${webex.refresh-token:}") String seedRefreshToken,
            @Value("${webex.default-host-email:}") String defaultHostEmail,
            @Value("${webex.session-type-id:3}") int sessionTypeId,
            @Value("${webex.enabled:true}") boolean enabled,
            WebexCredentialsRepository credentialsRepository,
            PiiEncryptionService piiEncryption
    ) {
        this.clientId = trimToNull(clientId);
        this.clientSecret = trimToNull(clientSecret);
        this.serviceAppId = trimToNull(serviceAppId);
        this.orgId = trimToNull(orgId);
        this.seedRefreshToken = trimToNull(seedRefreshToken);
        this.defaultHostEmail = trimToNull(defaultHostEmail);
        // 0 / negative means "don't send sessionTypeId at all" — useful for
        // orgs whose host has a working default and where any explicit value
        // collides. Standard "Webex Meeting" is 3 for most installations.
        this.sessionTypeId = sessionTypeId > 0 ? sessionTypeId : null;
        this.enabled = enabled;
        this.credentialsRepository = credentialsRepository;
        this.piiEncryption = piiEncryption;

        if (!enabled) {
            log.info("[WebEx] force-disabled (WEBEX_ENABLED=false). Provider selector "
                    + "will not route to this implementation.");
        } else if (!hasCredentials()) {
            log.info("[WebEx] not configured — set WEBEX_CLIENT_ID, WEBEX_CLIENT_SECRET, "
                    + "WEBEX_ORG_ID (and WEBEX_REFRESH_TOKEN on first boot). The Service "
                    + "App must be authorized by a Full Admin in Control Hub.");
        }
    }

    @Override public String providerName() { return PROVIDER_NAME; }

    @Override
    public boolean isReady() {
        return enabled && hasCredentials();
    }

    @Override
    public boolean hasCredentials() {
        return clientId != null && clientSecret != null && orgId != null;
    }

    @Override
    public boolean isForceDisabled() { return !enabled; }

    /** True iff the DB row holds a non-expired refresh token (or the seed env var is present). */
    public boolean hasUsableRefreshToken() {
        if (seedRefreshToken != null) return true;
        return credentialsRepository.findCurrent()
                .map(c -> c.getRefreshTokenExpiresAt() == null
                        || c.getRefreshTokenExpiresAt().isAfter(Instant.now()))
                .orElse(false);
    }

    // ── Bootstrap ────────────────────────────────────────────────────────────

    @PostConstruct
    void onStartup() {
        if (!isReady()) return;
        try {
            seedFromEnvIfNeeded();
        } catch (Exception e) {
            log.warn("[WebEx] seed step failed (non-fatal): {}", e.getMessage());
        }
        // Non-blocking probe — boot stays responsive even if WebEx is slow.
        Thread probe = new Thread(() -> {
            try {
                String identity = probe();
                lastProbeError = null;
                log.info("[WebEx] authenticated as {} ({})", identity, authenticatedEmail);
            } catch (Exception e) {
                lastProbeError = e.getMessage();
                log.warn("[WebEx] TOKEN VALIDATION FAILED: {}", e.getMessage());
            }
        }, "webex-startup-probe");
        probe.setDaemon(true);
        probe.start();
    }

    /**
     * Seed the DB row from {@code WEBEX_REFRESH_TOKEN} env when:
     *   1. No row exists yet (first boot post-deploy), OR
     *   2. The env-provided value differs from the persisted one (manual rotation).
     *
     * <p>After successful steady-state refreshes, the persisted row evolves
     * via {@link #performRefresh}; the env value becomes informational. Operator
     * can clear it without breaking anything.</p>
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void seedFromEnvIfNeeded() {
        if (seedRefreshToken == null) {
            return;
        }
        var existing = credentialsRepository.findCurrent();
        if (existing.isPresent()) {
            String currentPlain = decryptOrNull(existing.get().getRefreshToken());
            if (seedRefreshToken.equals(currentPlain)) {
                log.debug("[WebEx] env refresh token matches persisted value — no reseed");
                return;
            }
            existing.get().setRefreshToken(piiEncryption.encrypt(seedRefreshToken));
            existing.get().setRefreshTokenExpiresAt(null); // unknown until first refresh
            existing.get().setAccessToken(null);
            existing.get().setAccessTokenExpiresAt(null);
            existing.get().setLastSource("manual-reseed");
            credentialsRepository.save(existing.get());
            log.warn("[WebEx] refresh token re-seeded from WEBEX_REFRESH_TOKEN env "
                    + "(supersedes persisted value)");
            return;
        }
        WebexCredentials row = WebexCredentials.builder()
                .refreshToken(piiEncryption.encrypt(seedRefreshToken))
                .lastSource("seed-env")
                .build();
        credentialsRepository.save(row);
        log.info("[WebEx] refresh token seeded from WEBEX_REFRESH_TOKEN env (first boot)");
    }

    // ── Probe ────────────────────────────────────────────────────────────────

    /**
     * Calls {@code GET /meetings?max=1} to verify the access token works AND
     * the granted scopes cover the meeting surface we actually use. The
     * Service App is provisioned with {@code meeting:admin_schedule_read /
     * _write}, {@code meeting:admin_recordings_read}, {@code
     * meeting:admin_transcripts_read} — NOT any {@code spark:people_*} /
     * identity scopes, so a {@code /people/me} probe (the previous shape)
     * 403s "missing required scopes" even when the meeting API works fine.
     *
     * <p>The meeting list endpoint is the smallest validator of the live
     * write path: a 200 (even with an empty {@code items} array) proves the
     * access token resolved AND has at least {@code meeting:admin_schedule_read}.
     * Anything 3xx+ propagates the body to the caller so the startup probe
     * log + the {@code /api/v1/admin/health/webex} endpoint show what went
     * wrong without leaking the bearer token.</p>
     */
    @Override
    public String probe() throws Exception {
        ensureReady();
        HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                .uri(URI.create(API_BASE + "/meetings?max=1"))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build());
        if (resp.statusCode() >= 300) {
            throw new RuntimeException("WebEx /meetings?max=1 failed: status="
                    + resp.statusCode() + " body=" + truncate(resp.body()));
        }
        // The list endpoint doesn't return an identity (the Service App is a
        // machine principal, not a person). Surface a deterministic
        // "authenticated" string built from what we DO know about this
        // installation — the org id and the count of meetings visible to the
        // service principal — so the health endpoint has something stable to
        // display instead of going blank.
        JsonNode node = objectMapper.readTree(resp.body());
        int meetingCount = node.path("items").isArray()
                ? node.path("items").size() : 0;
        String firstHost = node.path("items").path(0).path("hostEmail").asText(null);
        this.authenticatedEmail = firstNonBlank(firstHost, null);
        String identity = "WebEx Service App (org=" + (orgId == null ? "?" : orgId)
                + ", meetingsVisible=" + meetingCount + ")";
        this.authenticatedDisplayName = identity;
        return identity;
    }

    // ── Meeting CRUD ─────────────────────────────────────────────────────────

    @Override
    public MeetingResponse createMeeting(MeetingRequest req) {
        ensureReady();
        try {
            ObjectNode body = buildMeetingPayload(req);
            HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                    .uri(URI.create(API_BASE + "/meetings"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(20))
                    .POST(HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                    .build());
            return parseMeetingResponse(resp, "createMeeting");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("WebEx createMeeting failed: " + e.getMessage(), e);
        }
    }

    @Override
    public MeetingResponse updateMeeting(String providerMeetingId, MeetingRequest req) {
        ensureReady();
        if (providerMeetingId == null || providerMeetingId.isBlank()) {
            throw new IllegalArgumentException("providerMeetingId is required");
        }
        try {
            ObjectNode body = buildMeetingPayload(req);
            HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                    .uri(URI.create(API_BASE + "/meetings/" + encode(providerMeetingId)))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(20))
                    .method("PUT", HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                    .build());
            return parseMeetingResponse(resp, "updateMeeting");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("WebEx updateMeeting failed: " + e.getMessage(), e);
        }
    }

    @Override
    public MeetingResponse getMeeting(String providerMeetingId) {
        ensureReady();
        if (providerMeetingId == null || providerMeetingId.isBlank()) {
            throw new IllegalArgumentException("providerMeetingId is required");
        }
        try {
            HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                    .uri(URI.create(API_BASE + "/meetings/" + encode(providerMeetingId)))
                    .timeout(Duration.ofSeconds(15))
                    .GET()
                    .build());
            return parseMeetingResponse(resp, "getMeeting");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("WebEx getMeeting failed: " + e.getMessage(), e);
        }
    }

    @Override
    public void deleteMeeting(String providerMeetingId) {
        ensureReady();
        if (providerMeetingId == null || providerMeetingId.isBlank()) {
            throw new IllegalArgumentException("providerMeetingId is required");
        }
        try {
            HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                    .uri(URI.create(API_BASE + "/meetings/" + encode(providerMeetingId)))
                    .timeout(Duration.ofSeconds(15))
                    .DELETE()
                    .build());
            // 204 on success; 404 means already-deleted (treat as success).
            if (resp.statusCode() >= 300 && resp.statusCode() != 404) {
                throw new RuntimeException("WebEx deleteMeeting failed: status="
                        + resp.statusCode() + " body=" + truncate(resp.body()));
            }
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("WebEx deleteMeeting failed: " + e.getMessage(), e);
        }
    }

    // ── Token cache ──────────────────────────────────────────────────────────

    private String getAccessToken() throws Exception {
        Instant exp = cachedAccessExpiresAt;
        if (cachedAccessToken != null && exp != null
                && Instant.now().isBefore(exp.minus(REFRESH_WINDOW))) {
            return cachedAccessToken;
        }
        refreshLock.lock();
        try {
            exp = cachedAccessExpiresAt;
            if (cachedAccessToken != null && exp != null
                    && Instant.now().isBefore(exp.minus(REFRESH_WINDOW))) {
                return cachedAccessToken;
            }
            return performRefresh();
        } finally {
            refreshLock.unlock();
        }
    }

    /**
     * Hits the token endpoint with {@code grant_type=refresh_token}, parses
     * the new pair, persists the new refresh token back to the singleton row,
     * updates the in-memory access-token cache, and refreshes the
     * {@link #refreshTokenExpiresAt} marker for the health endpoint.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String performRefresh() throws Exception {
        WebexCredentials current = credentialsRepository.findCurrent()
                .orElseThrow(() -> new IllegalStateException(
                        "WebEx refresh token not persisted — set WEBEX_REFRESH_TOKEN "
                                + "env (from the Service App's authorization flow) and "
                                + "redeploy to seed."));
        String refreshPlain = decryptOrNull(current.getRefreshToken());
        if (refreshPlain == null || refreshPlain.isBlank()) {
            throw new IllegalStateException(
                    "WebEx refresh token row exists but decrypts blank — re-seed via WEBEX_REFRESH_TOKEN.");
        }
        if (current.getRefreshTokenExpiresAt() != null
                && Instant.now().isAfter(current.getRefreshTokenExpiresAt())) {
            throw new IllegalStateException(
                    "WebEx refresh token expired at " + current.getRefreshTokenExpiresAt()
                            + " — obtain a fresh token from Control Hub and re-seed via "
                            + "WEBEX_REFRESH_TOKEN env.");
        }

        String form = "grant_type=refresh_token"
                + "&client_id=" + encode(clientId)
                + "&client_secret=" + encode(clientSecret)
                + "&refresh_token=" + encode(refreshPlain);
        HttpResponse<String> resp = http.send(HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(form, StandardCharsets.UTF_8))
                .build(), HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() >= 300) {
            throw new RuntimeException("WebEx token refresh failed: status="
                    + resp.statusCode() + " body=" + truncate(resp.body()));
        }
        JsonNode node = objectMapper.readTree(resp.body());
        String newAccess = node.path("access_token").asText(null);
        String newRefresh = node.path("refresh_token").asText(null);
        long expiresIn = node.path("expires_in").asLong(1209600L); // ~14d default
        long refreshExpiresIn = node.path("refresh_token_expires_in").asLong(7776000L); // ~90d default
        if (newAccess == null) {
            throw new RuntimeException("WebEx token refresh returned no access_token");
        }
        Instant accessExpiresAt = Instant.now().plusSeconds(expiresIn);
        Instant refreshExpiresAt = Instant.now().plusSeconds(refreshExpiresIn);

        // Persist the rotated pair. If WebEx returned a NEW refresh token,
        // overwrite ours; some refresh endpoints reuse the same one — handle
        // both shapes by only updating when the value is present.
        current.setAccessToken(piiEncryption.encrypt(newAccess));
        current.setAccessTokenExpiresAt(accessExpiresAt);
        if (newRefresh != null && !newRefresh.isBlank()) {
            current.setRefreshToken(piiEncryption.encrypt(newRefresh));
            current.setRefreshTokenExpiresAt(refreshExpiresAt);
        }
        current.setLastSource("refresh-rotation");
        credentialsRepository.save(current);

        cachedAccessToken = newAccess;
        cachedAccessExpiresAt = accessExpiresAt;
        this.refreshTokenExpiresAt = current.getRefreshTokenExpiresAt();
        log.info("[WebEx] token refreshed (access expires {}, refresh expires {})",
                accessExpiresAt, current.getRefreshTokenExpiresAt());
        return newAccess;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private HttpResponse<String> sendAuthorized(HttpRequest req) throws Exception {
        String token = getAccessToken();
        HttpRequest authed = HttpRequest.newBuilder(req, (n, v) -> true)
                .header("Authorization", "Bearer " + token)
                .build();
        HttpResponse<String> resp = http.send(authed, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 429) {
            String retryAfter = resp.headers().firstValue("retry-after").orElse("?");
            log.warn("[WebEx] rate limited (429), retry-after={}", retryAfter);
        } else if (resp.statusCode() >= 400) {
            log.warn("[WebEx] {} {} -> status={} body={}",
                    authed.method(), authed.uri(),
                    resp.statusCode(), truncate(resp.body()));
        }
        return resp;
    }

    private MeetingResponse parseMeetingResponse(HttpResponse<String> resp, String op)
            throws Exception {
        if (resp.statusCode() >= 300) {
            throw new RuntimeException("WebEx " + op + " failed: status="
                    + resp.statusCode() + " body=" + truncate(resp.body()));
        }
        JsonNode node = objectMapper.readTree(resp.body());
        String meetingId = node.path("id").asText(null);
        String joinUrl = firstNonBlank(
                node.path("webLink").asText(null),
                node.path("joinUrl").asText(null));
        String startUrl = firstNonBlank(
                node.path("hostLink").asText(null),
                node.path("startLink").asText(null));
        String password = firstNonBlank(
                node.path("password").asText(null),
                node.path("meetingPassword").asText(null));
        String hostEmail = node.path("hostEmail").asText(null);
        return new MeetingResponse(PROVIDER_NAME, meetingId, joinUrl, startUrl, password, hostEmail);
    }

    private ObjectNode buildMeetingPayload(MeetingRequest req) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("title", req.topic());
        // WebEx requires the start/end timestamps to be in the same offset
        // as the declared timezone field — sending "...Z" while timezone
        // says "Asia/Kolkata" 400s with
        //   "timezone 'Asia/Kolkata' and timezone offset in '...Z' do not match"
        // We resolve the IANA zone first, then format start/end as
        // ISO_OFFSET_DATE_TIME against that zone so the strings carry the
        // matching offset (e.g. 2026-06-26T21:30:00+05:30). When the zone
        // string is invalid we fall back to UTC + the explicit "+00:00"
        // offset rather than the bare Z form to keep WebEx happy.
        String tz = (req.timezone() == null || req.timezone().isBlank())
                ? "UTC" : req.timezone();
        java.time.ZoneId zone;
        try {
            zone = java.time.ZoneId.of(tz);
        } catch (java.time.DateTimeException e) {
            log.warn("[WebEx] unknown timezone '{}' — falling back to UTC", tz);
            tz = "UTC";
            zone = java.time.ZoneOffset.UTC;
        }
        if (req.startTime() != null) {
            // Past/near-now guard. WebEx rejects creates whose start lands
            // at-or-before its server clock with "Parameter 'start' or 'end'
            // is before current time" — and "current" is evaluated after
            // network round-trip, so a meeting scheduled for exactly "now"
            // (or a few seconds back) lands past from WebEx's perspective.
            // Floor start at now + SAFETY_BUFFER so legitimately-future
            // intents survive the trip without spurious 400s; log a warn
            // when we bump so a real "scheduled for the past" UI bug stays
            // visible. End is recomputed from the (possibly bumped) start so
            // duration stays correct regardless.
            java.time.Instant requested = req.startTime();
            java.time.Instant earliest = Instant.now().plusSeconds(60);
            java.time.Instant effective = requested.isBefore(earliest)
                    ? earliest : requested;
            if (effective != requested) {
                log.warn("[WebEx] start {} is at-or-before now+60s — bumping to {} "
                        + "to clear WebEx's 'before current time' rejection",
                        requested, effective);
            }
            java.time.ZonedDateTime startZdt = effective.atZone(zone);
            java.time.ZonedDateTime endZdt = startZdt.plusMinutes(
                    clampDuration(req.durationMinutes()));
            body.put("start", startZdt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
            body.put("end", endZdt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        }
        body.put("timezone", tz);
        // Host email normalization — drop the Zoom-only "me" sentinel that
        // some consumers pass when no per-user zoom_email is set, fall back
        // to WEBEX_DEFAULT_HOST_EMAIL when configured, and omit the field
        // entirely otherwise (WebEx then hosts the meeting under the
        // Service App's authorizing admin user, which is a sane default for
        // the admin-scope grant we operate under). Sending "me" verbatim
        // 400s with "The 'me' email format is invalid."
        String resolvedHost = resolveWebexHostEmail(req.hostEmail());
        if (resolvedHost != null) {
            body.put("hostEmail", resolvedHost);
        }
        if (req.agenda() != null && !req.agenda().isBlank()) {
            body.put("agenda", req.agenda());
        }
        // sessionTypeId is required by WebEx when the resolved host doesn't
        // have a default session type configured in Control Hub — which is
        // the common case for a Service-App-admin host. Omitting it 400s
        // with "Session type not found by Session type ID". Standard
        // "Webex Meeting" type is 3 in most orgs; operators can override
        // via WEBEX_SESSION_TYPE_ID env (or set 0 to opt out entirely).
        if (sessionTypeId != null) {
            body.put("sessionTypeId", sessionTypeId);
        }
        body.put("enabledJoinBeforeHost", false);
        body.put("enableConnectAudioBeforeHost", false);
        return body;
    }

    /** WebEx allows 10–1439 minutes (23h59m). */
    private int clampDuration(int minutes) {
        if (minutes < 10) return 10;
        if (minutes > 1439) return 1439;
        return minutes;
    }

    /**
     * Map the generic {@link MeetingRequest#hostEmail()} (which carries the
     * Zoom-era {@code "me"} sentinel for "no per-user email known") into a
     * WebEx-valid value:
     * <ul>
     *   <li>real-looking email (non-blank, not {@code "me"}, contains {@code @})
     *       → use as-is.</li>
     *   <li>otherwise, if {@code WEBEX_DEFAULT_HOST_EMAIL} is configured →
     *       fall back to that (the org admin or a shared service host).</li>
     *   <li>otherwise → {@code null} → caller omits the {@code hostEmail}
     *       field on the create body, and WebEx hosts under the Service
     *       App's authorizing admin user.</li>
     * </ul>
     */
    private String resolveWebexHostEmail(String requested) {
        if (requested != null && !requested.isBlank()
                && !"me".equalsIgnoreCase(requested.trim())
                && requested.indexOf('@') > 0) {
            return requested.trim();
        }
        if (defaultHostEmail != null) {
            if (requested != null && "me".equalsIgnoreCase(requested.trim())) {
                log.debug("[WebEx] requested host \"me\" replaced with configured "
                        + "WEBEX_DEFAULT_HOST_EMAIL");
            }
            return defaultHostEmail;
        }
        if (requested != null && "me".equalsIgnoreCase(requested.trim())) {
            log.debug("[WebEx] requested host \"me\" omitted from create body "
                    + "(no WEBEX_DEFAULT_HOST_EMAIL); meeting will host under the "
                    + "Service App's admin user");
        }
        return null;
    }

    private String decryptOrNull(String ciphertext) {
        if (ciphertext == null || ciphertext.isBlank()) return null;
        try {
            return piiEncryption.decrypt(ciphertext);
        } catch (Exception e) {
            log.warn("[WebEx] decrypt failed (corrupted ciphertext?): {}", e.getMessage());
            return null;
        }
    }

    private void ensureReady() {
        if (!isReady()) {
            throw new IllegalStateException(
                    "WebEx integration is not enabled or credentials are missing");
        }
    }

    private static String encode(String s) {
        return s == null ? "" : URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String truncate(String s) {
        if (s == null) return "";
        return s.length() > 400 ? s.substring(0, 400) + "..." : s;
    }

    private static String firstNonBlank(String... vals) {
        if (vals == null) return null;
        for (String v : vals) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
