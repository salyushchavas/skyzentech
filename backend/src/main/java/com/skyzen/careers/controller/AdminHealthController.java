package com.skyzen.careers.controller;

import com.skyzen.careers.github.GitHubService;
import com.skyzen.careers.integration.zoom.ZoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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

    // The legacy DocuSign health probe was removed when signing moved
    // to the in-house IDMS flow (signing is local — no external endpoint
    // to probe). GitHub + Zoom probes above remain.
}
