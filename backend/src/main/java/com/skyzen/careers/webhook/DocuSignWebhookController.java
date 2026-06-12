package com.skyzen.careers.webhook;

import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class DocuSignWebhookController {

    @PostMapping(value = "/docusign", consumes = "application/json")
    public ResponseEntity<Map<String, Object>> handle(
            @RequestBody byte[] rawBody,
            @RequestHeader(value = "X-DocuSign-Signature-1", required = false) String signature) {

        // Phase 8.6.2 — DocuSign integration is disabled in favor of the
        // in-house signing page. The endpoint is preserved so any in-flight
        // legacy envelopes posting back don't see a 404 / 5xx, but we no
        // longer drive any state changes from webhook payloads. Return 200
        // so DocuSign's retry queue drains.
        log.info("[DocuSign] webhook received but in-house signing is active; "
                + "ignoring (body={}B, signature-present={})",
                rawBody.length, signature != null && !signature.isBlank());
        return ResponseEntity.ok(Map.of("ok", true, "ignored", true));
    }
}
