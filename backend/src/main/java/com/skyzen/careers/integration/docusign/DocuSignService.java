package com.skyzen.careers.integration.docusign;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jsonwebtoken.Jwts;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

/**
 * DocuSign Server-side JWT-grant client for the offer-letter flow.
 *
 * <h2>Boot semantics</h2>
 * Soft-configured. If {@code docusign.enabled=false} or any credential is
 * blank/malformed every public call throws {@link IllegalStateException}; the
 * bean still constructs so the rest of the app boots. Phase 3 explicitly
 * supports a "NO-OP" mode where the platform persists offers without
 * envelope ids and the ERM shares the link manually.
 *
 * <h2>Token cache</h2>
 * Single in-process bearer token, refreshed when ≤60s remain. Serialised by
 * a {@link ReentrantLock} so concurrent callers piggy-back on one refresh.
 *
 * <h2>Consent</h2>
 * First call against a new integration/user pair may return
 * {@code consent_required}. The startup probe surfaces that with a one-shot
 * log line containing the exact consent URL the admin must visit, then
 * proceeds without crashing. Once consent is granted out-of-band the next
 * probe (next boot or the next live call) succeeds.
 *
 * <h2>Webhook signing</h2>
 * {@link #verifyWebhookSignature(byte[], String)} computes HMAC-SHA256 over
 * the raw request body and constant-time-compares it to the value DocuSign
 * sends in {@code X-DocuSign-Signature-1}. Constant-time prevents timing
 * oracles on the HMAC key.
 */
@Service
@Slf4j
public class DocuSignService {

    private static final Duration REFRESH_WINDOW = Duration.ofSeconds(60);
    private static final Duration JWT_TTL = Duration.ofMinutes(60);

    private final String integrationKey;
    private final String userId;
    private final String accountId;
    private final PrivateKey privateKey;
    private final String baseUrl;
    private final String oauthBase;
    @Getter
    private final String templateId;
    private final byte[] webhookHmacKey;
    @Getter
    private final boolean enabled;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ReentrantLock refreshLock = new ReentrantLock();

    private volatile String cachedToken;
    private volatile Instant cachedExpiresAt;

    @Getter
    private volatile String authenticatedAccountName;

    public DocuSignService(
            @Value("${docusign.integration-key:}") String integrationKey,
            @Value("${docusign.user-id:}") String userId,
            @Value("${docusign.account-id:}") String accountId,
            @Value("${docusign.private-key:}") String privateKeyPem,
            @Value("${docusign.base-url:https://demo.docusign.net/restapi}") String baseUrl,
            @Value("${docusign.oauth-base:https://account-d.docusign.com}") String oauthBase,
            @Value("${docusign.template-id:}") String templateId,
            @Value("${docusign.webhook-hmac-key:}") String webhookHmacKey,
            @Value("${docusign.enabled:false}") boolean enabled
    ) {
        this.integrationKey = trimToNull(integrationKey);
        this.userId = trimToNull(userId);
        this.accountId = trimToNull(accountId);
        this.privateKey = parsePrivateKeyOrNull(privateKeyPem);
        this.baseUrl = trimToNull(baseUrl);
        this.oauthBase = trimToNull(oauthBase);
        this.templateId = trimToNull(templateId);
        String hmac = trimToNull(webhookHmacKey);
        this.webhookHmacKey = hmac == null ? null : hmac.getBytes(StandardCharsets.UTF_8);
        this.enabled = enabled;

        if (!enabled) {
            log.info("[DocuSign] disabled (docusign.enabled=false). Offers will persist "
                    + "with envelopeId=null; ERM shares signing link manually.");
        } else if (!hasCredentials()) {
            log.warn("[DocuSign] enabled but credentials incomplete. Set "
                    + "DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID, "
                    + "DOCUSIGN_PRIVATE_KEY. Calls will throw IllegalStateException.");
        }
    }

    public boolean isReady() {
        return enabled && hasCredentials();
    }

    public boolean isTemplateConfigured() {
        return templateId != null;
    }

    private boolean hasCredentials() {
        return integrationKey != null
                && userId != null
                && accountId != null
                && privateKey != null
                && baseUrl != null
                && oauthBase != null;
    }

    // ── Startup probe ───────────────────────────────────────────────────────

    @PostConstruct
    void onStartup() {
        if (!isReady()) return;
        Thread probe = new Thread(() -> {
            try {
                String name = probeAccount();
                authenticatedAccountName = name;
                log.info("[DocuSign] authenticated, account: {}", name);
            } catch (ConsentRequiredException e) {
                log.warn("[DocuSign] CONSENT REQUIRED — admin must grant consent at "
                        + "{}/oauth/auth?response_type=code&scope=signature%20impersonation"
                        + "&client_id={}&redirect_uri=https://www.docusign.com",
                        oauthBase, integrationKey);
            } catch (Exception e) {
                log.warn("[DocuSign] TOKEN VALIDATION FAILED: {}", e.getMessage());
            }
        }, "docusign-startup-probe");
        probe.setDaemon(true);
        probe.start();
    }

    /** Calls GET /v2.1/accounts/{accountId}; returns the account name on success. */
    public String probeAccount() throws Exception {
        ensureReady();
        HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/v2.1/accounts/" + accountId))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build());
        if (resp.statusCode() >= 300) {
            throw new RuntimeException("DocuSign /accounts/{id} failed: status="
                    + resp.statusCode() + " body=" + truncate(resp.body()));
        }
        JsonNode node = objectMapper.readTree(resp.body());
        return node.path("accountName").asText(null);
    }

    // ── Envelope CRUD ───────────────────────────────────────────────────────

    public EnvelopeResponse createEnvelopeFromTemplate(EnvelopeRequest req) {
        ensureReady();
        String useTemplateId = req.templateId() != null && !req.templateId().isBlank()
                ? req.templateId() : templateId;
        if (useTemplateId == null) {
            throw new IllegalStateException(
                    "DocuSign template id not configured (docusign.template-id is blank)");
        }
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("templateId", useTemplateId);
            body.put("status", "sent");
            if (req.emailSubject() != null) body.put("emailSubject", req.emailSubject());
            if (req.emailBlurb() != null) body.put("emailBlurb", req.emailBlurb());
            ArrayNode roles = body.putArray("templateRoles");
            ObjectNode role = roles.addObject();
            role.put("email", req.recipientEmail());
            role.put("name", req.recipientName());
            role.put("roleName", "Applicant");
            if (req.recipientClientUserId() != null) {
                role.put("clientUserId", req.recipientClientUserId().toString());
            }
            if (req.customFields() != null && !req.customFields().isEmpty()) {
                ObjectNode tabs = role.putObject("tabs");
                ArrayNode textTabs = tabs.putArray("textTabs");
                for (Map.Entry<String, String> e : req.customFields().entrySet()) {
                    ObjectNode tab = textTabs.addObject();
                    tab.put("tabLabel", e.getKey());
                    tab.put("value", e.getValue() == null ? "" : e.getValue());
                }
            }
            HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/v2.1/accounts/" + accountId + "/envelopes"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(20))
                    .POST(HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                    .build());
            if (resp.statusCode() >= 300) {
                throw new RuntimeException("DocuSign createEnvelope failed: status="
                        + resp.statusCode() + " body=" + truncate(resp.body()));
            }
            JsonNode node = objectMapper.readTree(resp.body());
            return new EnvelopeResponse(
                    node.path("envelopeId").asText(null),
                    node.path("status").asText(null),
                    parseInstant(node.path("statusDateTime").asText(null)),
                    node.path("uri").asText(null));
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("DocuSign createEnvelope failed: " + e.getMessage(), e);
        }
    }

    /** Polls the envelope status. Used by the manual refresh-status flow. */
    public EnvelopeResponse getEnvelope(String envelopeId) {
        ensureReady();
        try {
            HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/v2.1/accounts/" + accountId
                            + "/envelopes/" + encode(envelopeId)))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build());
            if (resp.statusCode() >= 300) {
                throw new RuntimeException("DocuSign getEnvelope failed: status="
                        + resp.statusCode() + " body=" + truncate(resp.body()));
            }
            JsonNode node = objectMapper.readTree(resp.body());
            return new EnvelopeResponse(
                    node.path("envelopeId").asText(null),
                    node.path("status").asText(null),
                    parseInstant(node.path("statusChangedDateTime").asText(null)),
                    node.path("uri").asText(null));
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("DocuSign getEnvelope failed: " + e.getMessage(), e);
        }
    }

    /** Downloads the combined signed PDF (all documents in one PDF). */
    public byte[] downloadSignedPdf(String envelopeId) {
        ensureReady();
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/v2.1/accounts/" + accountId
                            + "/envelopes/" + encode(envelopeId)
                            + "/documents/combined?include_envelope_id=false"))
                    .header("Authorization", "Bearer " + getAccessToken())
                    .timeout(Duration.ofSeconds(30))
                    .GET()
                    .build();
            HttpResponse<byte[]> resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() >= 300) {
                throw new RuntimeException("DocuSign downloadSignedPdf failed: status="
                        + resp.statusCode());
            }
            return resp.body();
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("DocuSign downloadSignedPdf failed: " + e.getMessage(), e);
        }
    }

    public void voidEnvelope(String envelopeId, String reason) {
        ensureReady();
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("status", "voided");
            body.put("voidedReason", reason == null ? "Voided by ERM" : reason);
            HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/v2.1/accounts/" + accountId
                            + "/envelopes/" + encode(envelopeId)))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .method("PUT", HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                    .build());
            if (resp.statusCode() >= 300 && resp.statusCode() != 200) {
                throw new RuntimeException("DocuSign voidEnvelope failed: status="
                        + resp.statusCode() + " body=" + truncate(resp.body()));
            }
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("DocuSign voidEnvelope failed: " + e.getMessage(), e);
        }
    }

    public void resendEnvelope(String envelopeId) {
        ensureReady();
        try {
            HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/v2.1/accounts/" + accountId
                            + "/envelopes/" + encode(envelopeId)
                            + "?resend_envelope=true"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .method("PUT", HttpRequest.BodyPublishers.ofString(
                            "{\"status\":\"sent\"}", StandardCharsets.UTF_8))
                    .build());
            if (resp.statusCode() >= 300) {
                throw new RuntimeException("DocuSign resendEnvelope failed: status="
                        + resp.statusCode() + " body=" + truncate(resp.body()));
            }
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("DocuSign resendEnvelope failed: " + e.getMessage(), e);
        }
    }

    /**
     * Creates a one-shot embedded recipient-view URL. The {@code returnUrl}
     * is where DocuSign redirects after signing/cancellation/decline;
     * frontend uses {@code /careers/intern/offer/return}.
     */
    public String createRecipientViewUrl(String envelopeId,
                                         String returnUrl,
                                         String email,
                                         String userName,
                                         String clientUserId) {
        ensureReady();
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("returnUrl", returnUrl);
            body.put("authenticationMethod", "none");
            body.put("email", email);
            body.put("userName", userName);
            body.put("clientUserId", clientUserId);
            HttpResponse<String> resp = sendAuthorized(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/v2.1/accounts/" + accountId
                            + "/envelopes/" + encode(envelopeId) + "/views/recipient"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                    .build());
            if (resp.statusCode() >= 300) {
                throw new RuntimeException("DocuSign createRecipientView failed: status="
                        + resp.statusCode() + " body=" + truncate(resp.body()));
            }
            return objectMapper.readTree(resp.body()).path("url").asText(null);
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("DocuSign createRecipientView failed: " + e.getMessage(), e);
        }
    }

    // ── Webhook HMAC verification ───────────────────────────────────────────

    /**
     * Verifies DocuSign Connect's X-DocuSign-Signature-1 header against the
     * raw request body using HMAC-SHA256. Returns true on match. Constant-time
     * comparison via {@link MessageDigest#isEqual(byte[], byte[])}.
     */
    public boolean verifyWebhookSignature(byte[] rawBody, String headerValue) {
        if (webhookHmacKey == null) {
            log.warn("[DocuSign] webhook HMAC key not configured — refusing");
            return false;
        }
        if (rawBody == null || headerValue == null || headerValue.isBlank()) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookHmacKey, "HmacSHA256"));
            byte[] expected = mac.doFinal(rawBody);
            byte[] received;
            try {
                received = Base64.getDecoder().decode(headerValue.trim());
            } catch (IllegalArgumentException ex) {
                log.warn("[DocuSign] webhook header not base64");
                return false;
            }
            return MessageDigest.isEqual(expected, received);
        } catch (Exception e) {
            log.warn("[DocuSign] HMAC verify error: {}", e.getMessage());
            return false;
        }
    }

    // ── Token cache ─────────────────────────────────────────────────────────

    public String getAccessToken() throws Exception {
        Instant exp = cachedExpiresAt;
        if (cachedToken != null && exp != null
                && Instant.now().isBefore(exp.minus(REFRESH_WINDOW))) {
            return cachedToken;
        }
        refreshLock.lock();
        try {
            exp = cachedExpiresAt;
            if (cachedToken != null && exp != null
                    && Instant.now().isBefore(exp.minus(REFRESH_WINDOW))) {
                return cachedToken;
            }
            return refreshToken();
        } finally {
            refreshLock.unlock();
        }
    }

    private String refreshToken() throws Exception {
        Instant now = Instant.now();
        // JWT aud must be the OAuth hostname only (no scheme).
        String aud = oauthBase.replaceFirst("^https?://", "");
        String jwt = Jwts.builder()
                .issuer(integrationKey)
                .subject(userId)
                .audience().add(aud).and()
                .issuedAt(Date.from(now.minusSeconds(30))) // 30s clock skew slack
                .expiration(Date.from(now.plus(JWT_TTL)))
                .claim("scope", "signature impersonation")
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();

        String formBody = "grant_type=" + URLEncoder.encode(
                "urn:ietf:params:oauth:grant-type:jwt-bearer", StandardCharsets.UTF_8)
                + "&assertion=" + URLEncoder.encode(jwt, StandardCharsets.UTF_8);
        HttpResponse<String> resp = http.send(HttpRequest.newBuilder()
                .uri(URI.create(oauthBase + "/oauth/token"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(formBody, StandardCharsets.UTF_8))
                .build(), HttpResponse.BodyHandlers.ofString());

        if (resp.statusCode() == 400 && resp.body() != null
                && resp.body().contains("consent_required")) {
            throw new ConsentRequiredException("DocuSign consent_required");
        }
        if (resp.statusCode() >= 300) {
            throw new RuntimeException("DocuSign token fetch failed: status="
                    + resp.statusCode() + " body=" + truncate(resp.body()));
        }
        JsonNode node = objectMapper.readTree(resp.body());
        String token = node.path("access_token").asText(null);
        long expiresIn = node.path("expires_in").asLong(3600);
        if (token == null) {
            throw new RuntimeException("DocuSign token fetch returned no access_token");
        }
        cachedToken = token;
        cachedExpiresAt = Instant.now().plusSeconds(expiresIn);
        return token;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private HttpResponse<String> sendAuthorized(HttpRequest base) throws Exception {
        String token = getAccessToken();
        HttpRequest authed = HttpRequest.newBuilder(base, (n, v) -> true)
                .header("Authorization", "Bearer " + token)
                .build();
        HttpResponse<String> resp = http.send(authed, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() >= 400) {
            log.warn("[DocuSign] {} {} -> status={} body={}",
                    authed.method(), authed.uri(),
                    resp.statusCode(), truncate(resp.body()));
        }
        return resp;
    }

    private static Instant parseInstant(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Instant.parse(s); }
        catch (Exception e) { return null; }
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

    private static PrivateKey parsePrivateKeyOrNull(String pem) {
        if (pem == null || pem.isBlank()) return null;
        try {
            String body = pem.trim();
            body = body.replace("\\n", "\n");
            // PKCS8 ("PRIVATE KEY") or legacy PKCS1 ("RSA PRIVATE KEY"). DocuSign
            // examples in their docs use PKCS1 — but PKCS8 is what
            // KeyFactory.getInstance("RSA") consumes. If admins paste PKCS1 we
            // strip the markers anyway; KeyFactory will fail with a clear
            // message and the bean stays unconfigured.
            body = body.replaceAll("-----BEGIN (RSA )?PRIVATE KEY-----", "")
                       .replaceAll("-----END (RSA )?PRIVATE KEY-----", "")
                       .replaceAll("\\s+", "");
            byte[] decoded = Base64.getDecoder().decode(body.getBytes(StandardCharsets.US_ASCII));
            KeyFactory kf = KeyFactory.getInstance("RSA");
            return kf.generatePrivate(new PKCS8EncodedKeySpec(decoded));
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(DocuSignService.class)
                    .warn("Failed to parse DOCUSIGN_PRIVATE_KEY: {}", e.getMessage());
            return null;
        }
    }

    private void ensureReady() {
        if (!isReady()) {
            throw new IllegalStateException(
                    "DocuSign integration is not enabled or credentials are missing");
        }
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    /** Thrown by {@link #refreshToken()} when DocuSign returns consent_required. */
    public static final class ConsentRequiredException extends RuntimeException {
        public ConsentRequiredException(String message) {
            super(message);
        }
    }
}
