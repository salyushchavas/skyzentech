package com.skyzen.careers.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.skyzen.careers.github.GitHubService;
import com.skyzen.careers.integration.s3.S3StorageService;
import com.skyzen.careers.integration.webex.WebexService;
import com.skyzen.careers.integration.zoom.ZoomService;
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
    private final ZoomService zoomService;
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
     * Live Zoom probe — calls {@code GET /users/me} with the configured
     * Server-to-Server OAuth credentials. {@code authenticated=true} means
     * the token works AND the host email is resolvable.
     */
    @GetMapping("/zoom")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> zoom() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", zoomService.isReady());
        body.put("credentialsPresent", zoomService.hasCredentials());
        body.put("forceDisabled", zoomService.isForceDisabled());
        if (!zoomService.isReady()) {
            body.put("authenticated", false);
            if (zoomService.isForceDisabled()) {
                body.put("error",
                        "Zoom is force-disabled (ZOOM_ENABLED=false). Unset the var "
                                + "or set it to true to use the configured credentials.");
            } else {
                body.put("error",
                        "Zoom credentials missing — set ZOOM_ACCOUNT_ID, "
                                + "ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET on Railway from "
                                + "a Server-to-Server OAuth app with meeting:write scope.");
            }
            return body;
        }
        try {
            String host = zoomService.probeUsersMe();
            body.put("authenticated", host != null);
            body.put("host", host);
        } catch (Exception e) {
            body.put("authenticated", false);
            body.put("error", e.getMessage());
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
        // Inline session-types discovery so the operator can read valid
        // sessionTypeIds from this one endpoint without bouncing to
        // /webex/session-types or tailing boot logs. Always for the
        // Service App admin (no userEmail) — use the dedicated
        // /webex/session-types?userEmail=... endpoint to query a specific
        // host. The inline call is best-effort: failures populate
        // sessionTypesError without affecting the rest of the response.
        try {
            JsonNode types = webexService.fetchSessionTypes(null);
            body.put("sessionTypes", types.path("items"));
            int count = types.path("items").isArray() ? types.path("items").size() : 0;
            body.put("sessionTypesCount", count);
            if (count == 0) {
                body.put("sessionTypesHint",
                        "Empty array — Service App admin has no Webex Meetings license. "
                                + "License the user OR set WEBEX_DEFAULT_HOST_EMAIL and "
                                + "re-query /webex/session-types?userEmail=...");
            } else {
                body.put("sessionTypesHint",
                        "Pick the desired id and set WEBEX_SESSION_TYPE_ID on Railway. "
                                + "Restart, then schedule a meeting to confirm.");
            }
        } catch (Exception e) {
            body.put("sessionTypesError", e.getMessage());
        }
        return body;
    }

    /**
     * Diagnostic — list the WebEx session types valid for a given user.
     * The operator hits this when WebEx createMeeting 400s with "Session
     * type not found by Session type ID" and needs to discover which
     * numeric ids exist in their org so they can set
     * {@code WEBEX_SESSION_TYPE_ID} to a valid value.
     *
     * <p>Pass {@code ?userEmail=<email>} to query a specific host's
     * session types (admin scope). Omit to query the Service App admin
     * principal — an empty {@code items} array indicates the admin has
     * no Meetings license, in which case the operator needs to either
     * license that user or set {@code WEBEX_DEFAULT_HOST_EMAIL} to a
     * licensed user.</p>
     *
     * <p>Returns the raw {@code GET /v1/meetingPreferences/sessionTypes}
     * response so the operator sees the full record (id + name + meeting
     * type code) without us editorializing.</p>
     */
    @GetMapping("/webex/session-types")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> webexSessionTypes(
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
            JsonNode resp = webexService.fetchSessionTypes(userEmail);
            body.put("items", resp.path("items"));
            int count = resp.path("items").isArray() ? resp.path("items").size() : 0;
            body.put("count", count);
            if (count == 0) {
                body.put("hint", "Empty items[] means this user has no Webex Meetings "
                        + "license. Either license the user in Control Hub, or query a "
                        + "different host via ?userEmail=...");
            } else {
                body.put("hint", "Pick the id of your preferred type (commonly the one "
                        + "named 'Webex Meetings') and set WEBEX_SESSION_TYPE_ID to that "
                        + "integer on Railway.");
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
            @RequestParam(value = "sessionTypeId", required = false) Integer sessionTypeId,
            @RequestParam(value = "userEmail", required = false) String userEmail,
            @RequestParam(value = "siteUrl", required = false) String siteUrl) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("attemptedSessionTypeId", sessionTypeId);
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
            JsonNode created = webexService.testCreate(sessionTypeId, userEmail, siteUrl);
            body.put("ok", true);
            body.put("meetingId", created.path("id").asText(null));
            body.put("webLink", created.path("webLink").asText(null));
            body.put("hostEmailReturned", created.path("hostEmail").asText(null));
            body.put("siteUrlReturned", created.path("siteUrl").asText(null));
            body.put("note", "Test meeting created + auto-deleted. The "
                    + "sessionTypeId/userEmail/siteUrl combo above is valid for "
                    + "production schedules.");
        } catch (Exception e) {
            body.put("ok", false);
            body.put("error", e.getMessage());
        }
        return body;
    }

    // The legacy DocuSign health probe was removed when signing moved
    // to the in-house IDMS flow (signing is local — no external endpoint
    // to probe). GitHub + Zoom + S3 + WebEx probes above remain.
}
