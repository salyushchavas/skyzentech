package com.skyzen.careers.webhook;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.integration.docusign.DocuSignService;
import com.skyzen.careers.intern.OfferDocuSignService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * DocuSign Connect webhook. Receives envelope-completed (and voided /
 * declined / expired) notifications, verifies the HMAC signature, then
 * dispatches to {@link OfferDocuSignService#handleWebhookCompleted}.
 *
 * <p>Endpoint is permitted in SecurityConfig (no JWT). Authentication is
 * entirely via the HMAC header — anything that doesn't HMAC-match the
 * configured key is rejected 401.</p>
 *
 * <p>Body shape (Connect JSON):</p>
 * <pre>
 * {
 *   "event": "envelope-completed",
 *   "data": {
 *     "envelopeId": "...",
 *     "envelopeSummary": { "status": "completed", ... }
 *   }
 * }
 * </pre>
 *
 * <p>Idempotency lives downstream: {@link OfferDocuSignService} uses a
 * status guard so a re-fired webhook is a no-op.</p>
 */
@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
@Slf4j
public class DocuSignWebhookController {

    private final DocuSignService docuSignService;
    private final OfferDocuSignService offerDocuSignService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping(value = "/docusign", consumes = "application/json")
    public ResponseEntity<Map<String, Object>> handle(
            @RequestBody byte[] rawBody,
            @RequestHeader(value = "X-DocuSign-Signature-1", required = false) String signature) {

        if (!docuSignService.verifyWebhookSignature(rawBody, signature)) {
            log.warn("[DocuSign] webhook HMAC verification failed");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "invalid signature"));
        }

        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String envelopeId = firstNonNullText(
                    root.path("data").path("envelopeId"),
                    root.path("envelopeId"));
            String status = firstNonNullText(
                    root.path("data").path("envelopeSummary").path("status"),
                    root.path("data").path("envelopeStatus"),
                    root.path("envelopeStatus"),
                    root.path("status"));
            if (envelopeId == null || status == null) {
                log.warn("[DocuSign] webhook missing envelopeId/status (body={}B)", rawBody.length);
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "missing envelopeId or status"));
            }
            log.info("[DocuSign] webhook envelope={} status={}", envelopeId, status);
            offerDocuSignService.handleWebhookCompleted(envelopeId, status);
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "envelopeId", envelopeId,
                    "status", status));
        } catch (Exception e) {
            // Surface a 500 so DocuSign retries — the handler is idempotent
            // via the SIGNED-status guard so a successful retry won't
            // double-process.
            log.error("[DocuSign] webhook processing failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "processing failed", "message", e.getMessage()));
        }
    }

    private static String firstNonNullText(JsonNode... candidates) {
        for (JsonNode n : candidates) {
            if (n != null && !n.isMissingNode() && !n.isNull()) {
                String s = n.asText(null);
                if (s != null && !s.isBlank()) return s;
            }
        }
        return null;
    }
}
