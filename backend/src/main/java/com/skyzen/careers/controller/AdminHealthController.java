package com.skyzen.careers.controller;

import com.skyzen.careers.entity.Document;
import com.skyzen.careers.github.GitHubService;
import com.skyzen.careers.integration.s3.S3StorageService;
import com.skyzen.careers.integration.zoom.ZoomService;
import com.skyzen.careers.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

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
    private final DocumentRepository documentRepository;

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
     * TEMP — verify-after-migration probe. Given a {@code documentId},
     * reads the {@code storage_key} from the {@code documents} row and
     * exercises both {@code HeadObject} and {@code GetObject} against
     * it, surfacing each outcome (success + bytes count, or the
     * exception class + message) so we can disambiguate: IAM denial
     * vs key mismatch vs read-handling bug, without combing logs. To
     * be removed in the very next commit once the cause is pinned.
     */
    @GetMapping("/s3-getobject-probe")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> s3GetObjectProbe(@RequestParam UUID documentId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("documentId", documentId);
        Document d = documentRepository.findById(documentId).orElse(null);
        if (d == null) {
            body.put("error", "documents row not found");
            return body;
        }
        String key = d.getStorageKey();
        body.put("storageKey", key);
        body.put("storageKeyLeadingChar",
                key == null || key.isEmpty() ? null : String.valueOf(key.charAt(0)));
        body.put("looksLikeFilesystemPath",
                com.skyzen.careers.intern.DocumentVaultService.looksLikeFilesystemPath(key));
        body.put("sensitivity", d.getSensitivity());
        body.put("hasEncryptionMetadata", d.getEncryptionMetadataJson() != null);
        body.put("dbFileSize", d.getFileSize());
        // Volume-side existence probe (only meaningful when the key is a
        // filesystem path; null for S3 keys).
        if (key != null && com.skyzen.careers.intern.DocumentVaultService
                .looksLikeFilesystemPath(key)) {
            try {
                java.nio.file.Path p = java.nio.file.Paths.get(key);
                body.put("volumeAbsolutePath", p.toAbsolutePath().toString());
                body.put("volumeFileExists", java.nio.file.Files.exists(p));
                if (java.nio.file.Files.exists(p)) {
                    body.put("volumeFileSize", java.nio.file.Files.size(p));
                }
            } catch (Exception ex) {
                body.put("volumeExistsCheckError", ex.getMessage());
            }
        }
        // HeadObject probe
        try {
            HeadObjectResponse head = s3StorageService.headObject(key);
            if (head == null) {
                body.put("headOk", false);
                body.put("headResult", "null (NoSuchKey — object absent at this exact key)");
            } else {
                body.put("headOk", true);
                body.put("headSize", head.contentLength());
                body.put("headEtag", head.eTag());
            }
        } catch (Exception e) {
            body.put("headOk", false);
            body.put("headExceptionClass", e.getClass().getName());
            body.put("headExceptionMessage", e.getMessage());
        }
        // GetObject probe
        try {
            byte[] bytes = s3StorageService.getObject(key);
            body.put("getOk", true);
            body.put("getBytes", bytes.length);
        } catch (Exception e) {
            body.put("getOk", false);
            body.put("getExceptionClass", e.getClass().getName());
            body.put("getExceptionMessage", e.getMessage());
            Throwable cause = e.getCause();
            if (cause != null) {
                body.put("getCauseClass", cause.getClass().getName());
                body.put("getCauseMessage", cause.getMessage());
            }
        }
        return body;
    }

    // The legacy DocuSign health probe was removed when signing moved
    // to the in-house IDMS flow (signing is local — no external endpoint
    // to probe). GitHub + Zoom + S3 probes above remain.
}
