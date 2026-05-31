package com.skyzen.careers.github;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.concurrent.locks.ReentrantLock;

/**
 * GitHub App authentication. Mints installation access tokens for the
 * configured org installation and caches them in memory until ~5 minutes
 * before expiry.
 *
 * <h2>Boot semantics</h2>
 * Soft-configured. If any of the four env vars are missing or blank the bean
 * still constructs (boot doesn't fail), {@link #isConfigured()} returns
 * {@code false}, and any token-fetch call throws a clean
 * {@link IllegalStateException}. This lets non-prod environments come up
 * without a GitHub App registered while keeping production strict.
 *
 * <h2>Token cache</h2>
 * One token per JVM instance. The cache renews when the cached value is
 * within {@code REFRESH_WINDOW} of expiry; serialised by a {@link ReentrantLock}
 * so concurrent callers piggy-back on one refresh.
 *
 * <h2>This is the single GitHub auth seam</h2>
 * Future GitHub adapters (workspace provisioning, PR ops, activity polling)
 * MUST call {@link #getInstallationToken()} on this bean — never re-sign a
 * JWT or hit {@code /access_tokens} from another class.
 */
@Service
@Slf4j
public class GitHubService {

    /** Refresh when the cached token has less than this remaining. */
    private static final Duration REFRESH_WINDOW = Duration.ofMinutes(5);

    /** Max JWT lifetime per GitHub spec is 10 minutes; 9 minutes leaves slack for clock skew. */
    private static final Duration JWT_TTL = Duration.ofMinutes(9);

    private final String appId;
    private final String installationId;
    private final String orgName;
    private final PrivateKey privateKey;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ReentrantLock refreshLock = new ReentrantLock();

    // Token cache.
    private volatile String cachedToken;
    private volatile Instant cachedExpiresAt;

    public GitHubService(
            @Value("${app.github.app-id:}") String appId,
            @Value("${app.github.installation-id:}") String installationId,
            @Value("${app.github.org-name:}") String orgName,
            @Value("${app.github.private-key:}") String privateKeyPem
    ) {
        this.appId = trimToNull(appId);
        this.installationId = trimToNull(installationId);
        this.orgName = trimToNull(orgName);
        this.privateKey = parsePrivateKeyOrNull(privateKeyPem);

        if (!isConfigured()) {
            log.warn("GitHub App not configured — set GITHUB_APP_ID, "
                    + "GITHUB_INSTALLATION_ID, ORG_NAME, and GITHUB_PRIVATE_KEY "
                    + "to enable. Calls that mint installation tokens will throw "
                    + "IllegalStateException until configured.");
        } else {
            log.info("GitHub App configured (appId={}, installationId={}, org={}).",
                    this.appId, this.installationId, this.orgName);
        }
    }

    public boolean isConfigured() {
        return appId != null && installationId != null && orgName != null && privateKey != null;
    }

    public String getOrgName() {
        return orgName;
    }

    /**
     * Returns a non-expired installation access token, minting a new one if
     * the cache is empty or near expiry. Thread-safe.
     */
    public String getInstallationToken() {
        if (!isConfigured()) {
            throw new IllegalStateException(
                    "GitHub App is not configured — cannot mint installation token.");
        }
        if (isCachedTokenFresh()) return cachedToken;

        refreshLock.lock();
        try {
            // Double-check after acquiring the lock — another thread may have
            // refreshed while we were waiting.
            if (isCachedTokenFresh()) return cachedToken;
            mintInstallationToken();
            return cachedToken;
        } finally {
            refreshLock.unlock();
        }
    }

    private boolean isCachedTokenFresh() {
        return cachedToken != null
                && cachedExpiresAt != null
                && Instant.now().plus(REFRESH_WINDOW).isBefore(cachedExpiresAt);
    }

    /**
     * Sign a short-lived JWT and exchange it for an installation token via
     * the GitHub REST API. Updates the cache fields on success.
     */
    private void mintInstallationToken() {
        Instant now = Instant.now();
        String jwt = Jwts.builder()
                .issuer(appId)
                .issuedAt(Date.from(now.minusSeconds(30))) // 30s clock-skew slack
                .expiration(Date.from(now.plus(JWT_TTL)))
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();

        String url = "https://api.github.com/app/installations/" + installationId
                + "/access_tokens";
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + jwt)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException(
                        "GitHub /access_tokens responded " + response.statusCode()
                                + ": " + truncate(response.body(), 500));
            }
            JsonNode root = objectMapper.readTree(response.body());
            String token = root.path("token").asText(null);
            String expiresAtStr = root.path("expires_at").asText(null);
            if (token == null || expiresAtStr == null) {
                throw new IllegalStateException(
                        "GitHub /access_tokens response missing token or expires_at: "
                                + truncate(response.body(), 500));
            }
            this.cachedToken = token;
            this.cachedExpiresAt = Instant.parse(expiresAtStr);
            log.info("Refreshed GitHub installation token; expires at {}", cachedExpiresAt);
        } catch (IllegalStateException ise) {
            throw ise;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to mint GitHub installation token", e);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    /**
     * Parses a PEM-formatted PKCS#8 private key. Returns {@code null} if the
     * input is blank or malformed (so boot doesn't crash on bad config —
     * isConfigured() will return false and consumers throw at call time
     * with a clean message).
     */
    private static PrivateKey parsePrivateKeyOrNull(String pem) {
        if (pem == null || pem.isBlank()) return null;
        try {
            String body = pem.trim();
            // Env-var-friendly newline encoding: support literal \n inside a
            // single-line var by un-escaping. Existing real newlines pass through.
            body = body.replace("\\n", "\n");
            body = body.replaceAll("-----BEGIN (RSA )?PRIVATE KEY-----", "")
                       .replaceAll("-----END (RSA )?PRIVATE KEY-----", "")
                       .replaceAll("\\s+", "");
            byte[] decoded = Base64.getDecoder().decode(body.getBytes(StandardCharsets.US_ASCII));
            KeyFactory kf = KeyFactory.getInstance("RSA");
            return kf.generatePrivate(new PKCS8EncodedKeySpec(decoded));
        } catch (Exception e) {
            log.warn("Failed to parse GITHUB_PRIVATE_KEY (treating as unconfigured): {}",
                    e.getMessage());
            return null;
        }
    }
}
