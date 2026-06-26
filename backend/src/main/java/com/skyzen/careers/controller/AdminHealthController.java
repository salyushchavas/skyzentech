package com.skyzen.careers.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.skyzen.careers.github.GitHubService;
import com.skyzen.careers.integration.s3.S3StorageService;
import com.skyzen.careers.integration.webex.WebexService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * SUPER_ADMIN-only health probes for outbound integrations. Useful right
 * after a redeploy to verify the env vars + secrets are wired up without
 * combing through Railway logs.
 *
 * <p>{@code /api/v1/admin/health/github} hits GitHub's {@code /rate_limit}
 * via the configured App installation token and returns:</p>
 * <ul>
 *   <li>{@code enabled} — true when the four App env vars are set</li>
 *   <li>{@code authenticated} — true when the live probe succeeded</li>
 *   <li>{@code orgName} / {@code installationId} — what the App is bound to</li>
 *   <li>{@code rateLimitRemaining} / {@code rateLimitResetAt} — current quota</li>
 *   <li>{@code error} — present when authenticated is false; never contains the token</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/admin/health")
@RequiredArgsConstructor
public class AdminHealthController {

    private final GitHubService gitHubService;
    private final S3StorageService s3StorageService;
    private final WebexService webexService;

    @GetMapping("/github")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> github() {
        GitHubService.HealthSnapshot snap = gitHubService.probeHealth();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", snap.enabled());
        body.put("authenticated", snap.authenticated());
        body.put("orgName", snap.orgName());
        body.put("installationId", snap.installationId());
        body.put("rateLimitRemaining", snap.rateLimitRemaining());
        body.put("rateLimitResetAt", snap.rateLimitResetAtEpochSeconds() == null
                ? null
                : Instant.ofEpochSecond(snap.rateLimitResetAtEpochSeconds()).toString());
        if (snap.error() != null) {
            body.put("error", snap.error());
        }
        return body;
    }

    /**
     * Live S3 probe — calls {@code HeadObject} for a sentinel key
     * against the configured bucket using the resolved credentials.
     * {@code authenticated=true} means the call round-tripped without
     * an auth failure (HeadObject returns null on missing-key, which is
     * the success path; we only care that creds + bucket are valid).
     * The startup probe runs {@code HeadBucket} already; this endpoint
     * is the post-deploy "are env vars wired up" check.
     */
    @GetMapping("/s3")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> s3() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", s3StorageService.isReady());
        body.put("credentialsPresent", s3StorageService.hasCredentials());
        body.put("forceDisabled", s3StorageService.isForceDisabled());
        body.put("bucket", s3StorageService.getBucket());
        body.put("region", s3StorageService.getRegion());
        if (s3StorageService.getEndpointOverride() != null) {
            body.put("endpointOverride", s3StorageService.getEndpointOverride());
        }
        if (!s3StorageService.getBrandKeyPrefix().isEmpty()) {
            body.put("brandKeyPrefix", s3StorageService.getBrandKeyPrefix());
        }
        if (!s3StorageService.isReady()) {
            body.put("authenticated", false);
            if (s3StorageService.isForceDisabled()) {
                body.put("error",
                        "S3 is force-disabled (AWS_S3_ENABLED=false). Unset the var "
                                + "or set it to true to use the configured credentials.");
            } else {
                body.put("error",
                        "S3 credentials missing — set AWS_S3_BUCKET, AWS_REGION, "
                                + "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY on the "
                                + "deployment. Documents + resumes continue to use the volume.");
            }
            return body;
        }
        try {
            // headObject returns null when the object doesn't exist; that's
            // the success path here — we only verify the call round-tripped
            // without an auth/bucket failure.
            s3StorageService.headObject("__healthcheck__/probe");
            body.put("authenticated", true);
            body.put("startupProbedBucket", s3StorageService.getAuthenticatedBucket());
        } catch (Exception e) {
            body.put("authenticated", false);
            body.put("error", e.getMessage());
            String last = s3StorageService.getLastProbeError();
            if (last != null) body.put("lastStartupProbeError", last);
        }
        return body;
    }

    /**
     * Live WebEx probe — calls {@code GET /meetings?max=1} via the configured
     * Service App credentials. The probe targets a meeting-scope endpoint
     * (covered by the granted {@code meeting:admin_schedule_read} scope)
     * instead of {@code /people/me}, because the Service App is provisioned
     * with meeting + recording + transcript scopes only — no
     * {@code spark:people_*} identity scopes, so a person-endpoint probe
     * 403s "missing required scopes" even when the meeting API works fine.
     *
     * <p>Unlike Zoom, WebEx requires a persisted refresh token (the singleton
     * {@code webex_credentials} row, seeded via {@code WEBEX_REFRESH_TOKEN}
     * env on first boot). This endpoint reports separately:</p>
     * <ul>
     *   <li>{@code credentialsPresent} — client id/secret/org id env vars</li>
     *   <li>{@code refreshTokenAvailable} — seed env present OR persisted row</li>
     *   <li>{@code refreshTokenExpiresAt} — when the persisted refresh
     *       token's 90-day window closes (after which an operator must
     *       re-seed from Control Hub)</li>
     *   <li>{@code authenticated} — true when {@code /meetings?max=1}
     *       returns 200 using the access token (which may have been freshly
     *       refreshed by this call). The string {@code host} field is a
     *       deterministic label ({@code "WebEx Service App (org=..., meetingsVisible=N)"})
     *       since machine principals don't have a person identity.</li>
     * </ul>
     */
    @GetMapping("/webex")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> webex() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", webexService.isReady());
        body.put("credentialsPresent", webexService.hasCredentials());
        body.put("forceDisabled", webexService.isForceDisabled());
        body.put("refreshTokenAvailable", webexService.hasUsableRefreshToken());
        body.put("refreshTokenExpiresAt", webexService.getRefreshTokenExpiresAt() == null
                ? null
                : webexService.getRefreshTokenExpiresAt().toString());
        if (!webexService.isReady()) {
            body.put("authenticated", false);
            if (webexService.isForceDisabled()) {
                body.put("error",
                        "WebEx is force-disabled (WEBEX_ENABLED=false). Unset the var "
                                + "or set it to true to use the configured credentials.");
            } else {
                body.put("error",
                        "WebEx credentials missing — set WEBEX_CLIENT_ID, "
                                + "WEBEX_CLIENT_SECRET, WEBEX_ORG_ID on Railway from "
                                + "a Service App authorized by a Full Admin in Control "
                                + "Hub. On first boot also set WEBEX_REFRESH_TOKEN.");
            }
            return body;
        }
        if (!webexService.hasUsableRefreshToken()) {
            body.put("authenticated", false);
            body.put("error",
                    "WebEx refresh token missing or expired — set WEBEX_REFRESH_TOKEN "
                            + "from the Service App authorization flow and redeploy to seed.");
            return body;
        }
        try {
            String identity = webexService.probe();
            body.put("authenticated", identity != null);
            body.put("host", identity);
            body.put("hostEmail", webexService.getAuthenticatedEmail());
        } catch (Exception e) {
            body.put("authenticated", false);
            body.put("error", e.getMessage());
            String last = webexService.getLastProbeError();
            if (last != null) body.put("lastStartupProbeError", last);
        }
        // Inline sites discovery so the operator can read valid siteUrl
        // values from this one endpoint without bouncing to /webex/sites
        // or tailing boot logs. Always for the Service App admin (no
        // userEmail) — use the dedicated /webex/sites?userEmail=... endpoint
        // to query a specific host. The inline call is best-effort:
        // failures populate sitesError without affecting the rest of the
        // response.
        try {
            JsonNode resp = webexService.fetchSites(null);
            body.put("sites", resp.path("sites"));
            int count = resp.path("sites").isArray() ? resp.path("sites").size() : 0;
            body.put("sitesCount", count);
            if (count == 0) {
                body.put("sitesHint",
                        "Empty array — Service App admin has no Webex Meetings license. "
                                + "License the user OR set WEBEX_DEFAULT_HOST_EMAIL and "
                                + "re-query /webex/sites?userEmail=...");
            } else {
                body.put("sitesHint",
                        "Pick a siteUrl (typically default=true) and set WEBEX_SITE_URL "
                                + "on Railway. Restart, then test via POST "
                                + "/webex/test-create?userEmail=<licensed>&siteUrl=<picked>.");
            }
        } catch (Exception e) {
            body.put("sitesError", e.getMessage());
        }
        return body;
    }

    /**
     * Diagnostic — list the WebEx sites valid for a given user. The
     * operator hits this to discover which {@code siteUrl} value to set
     * on {@code WEBEX_SITE_URL}. The previous {@code /webex/session-types}
     * diagnostic was removed when the docs confirmed {@code POST /v1/meetings}
     * doesn't take {@code sessionTypeId} at all; sites are how Control Hub
     * meetings are routed.
     *
     * <p>Pass {@code ?userEmail=<email>} to query a specific host's sites
     * (admin scope). Omit to query the Service App admin principal — an
     * empty {@code sites} array indicates the admin has no Webex Meetings
     * license, in which case the operator needs to either license that
     * user or set {@code WEBEX_DEFAULT_HOST_EMAIL} to a licensed user.</p>
     */
    @GetMapping("/webex/sites")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> webexSites(
            @RequestParam(value = "userEmail", required = false) String userEmail) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", webexService.isReady());
        body.put("queryUserEmail", userEmail);
        if (!webexService.isReady()) {
            body.put("error", "WebEx not ready — check /api/v1/admin/health/webex first.");
            return body;
        }
        if (!webexService.hasUsableRefreshToken()) {
            body.put("error", "WebEx refresh token missing or expired — re-seed.");
            return body;
        }
        try {
            JsonNode resp = webexService.fetchSites(userEmail);
            body.put("sites", resp.path("sites"));
            int count = resp.path("sites").isArray() ? resp.path("sites").size() : 0;
            body.put("count", count);
            if (count == 0) {
                body.put("hint", "Empty sites[] means this user has no Webex Meetings "
                        + "license. Either license the user in Control Hub, or query a "
                        + "different host via ?userEmail=...");
            } else {
                body.put("hint", "Pick a siteUrl (typically the one with default=true) "
                        + "and set WEBEX_SITE_URL=<that string> on Railway.");
            }
        } catch (Exception e) {
            body.put("error", e.getMessage());
        }
        return body;
    }

    /**
     * Test-create probe — schedules a throwaway WebEx meeting 5 minutes
     * in the future with the given {@code sessionTypeId} and
     * {@code userEmail} overrides, then immediately deletes it on success.
     * Lets operators iterate on candidate Session Type IDs (looked up
     * manually in Control Hub when the discovery API 404s) without
     * scheduling real interviews.
     *
     * <p>Body / query options (all optional):
     * <ul>
     *   <li>{@code sessionTypeId} — integer candidate id; omit to use the
     *       configured {@code WEBEX_SESSION_TYPE_ID} (or omit-from-payload
     *       when that's 0/unset).</li>
     *   <li>{@code userEmail} — host email override; omit to use
     *       {@code WEBEX_DEFAULT_HOST_EMAIL} (or omit-from-payload when
     *       that's unset).</li>
     * </ul>
     *
     * <p>Returns {@code {ok: true, meetingId: ..., effectiveSessionTypeId: ...}}
     * on success (the meeting was created + auto-deleted), or
     * {@code {ok: false, error: "<WebEx error body>"}} on failure. The
     * error body carries WebEx's exact rejection so operators see e.g.
     * "Session type not found" vs "host email invalid" vs whatever.</p>
     */
    @PostMapping("/webex/test-create")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> webexTestCreate(
            @RequestParam(value = "userEmail", required = false) String userEmail,
            @RequestParam(value = "siteUrl", required = false) String siteUrl) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("attemptedUserEmail", userEmail);
        body.put("attemptedSiteUrl", siteUrl);
        if (!webexService.isReady()) {
            body.put("ok", false);
            body.put("error", "WebEx not ready — check /api/v1/admin/health/webex first.");
            return body;
        }
        if (!webexService.hasUsableRefreshToken()) {
            body.put("ok", false);
            body.put("error", "WebEx refresh token missing or expired — re-seed.");
            return body;
        }
        try {
            JsonNode created = webexService.testCreate(userEmail, siteUrl);
            body.put("ok", true);
            body.put("meetingId", created.path("id").asText(null));
            body.put("webLink", created.path("webLink").asText(null));
            // Surface both possible host-link field names so we can see
            // which one WebEx populates on POST /v1/meetings (varies by
            // API version + account). If both are null, the create response
            // doesn't carry the host link and WebexService falls back to
            // GET /v1/meetings/{id}?hostEmail=... to fetch it.
            body.put("startLink", created.path("startLink").asText(null));
            body.put("hostLink", created.path("hostLink").asText(null));
            body.put("startLinkSource", created.path("startLinkSource").asText(null));
            // Join-a-Meeting probe outcomes (WebexService.fetchHostStartLink).
            // These appear when WebexService.testCreate calls POST
            // /v1/meetings/join with createStartLinkAsWebLink=true after
            // the earlier fallbacks fail.
            body.put("joinApiHostStartLink", created.path("joinApiHostStartLink").asText(null));
            body.put("joinApiHostKey", created.path("joinApiHostKey").asText(null));
            body.put("joinApiExpiration", created.path("joinApiExpiration").asText(null));
            body.put("joinApiExpirationTime", created.path("joinApiExpirationTime").asText(null));
            body.put("joinApiError", created.path("joinApiError").asText(null));
            body.put("hostEmailReturned", created.path("hostEmail").asText(null));
            body.put("siteUrlReturned", created.path("siteUrl").asText(null));
            body.put("note", "Test meeting created + auto-deleted. The "
                    + "userEmail/siteUrl combo above is valid for production "
                    + "schedules — set WEBEX_DEFAULT_HOST_EMAIL + WEBEX_SITE_URL "
                    + "on Railway to make them the default.");
        } catch (Exception e) {
            body.put("ok", false);
            body.put("error", e.getMessage());
        }
        return body;
    }

    // The legacy DocuSign + Zoom health probes were removed: DocuSign
    // when signing moved to the in-house IDMS flow, Zoom when WebEx
    // became the sole meeting provider (verified live via the
    // test-create probe). GitHub + S3 + WebEx probes above remain.
}
