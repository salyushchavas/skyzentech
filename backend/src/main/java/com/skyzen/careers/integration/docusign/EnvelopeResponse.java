package com.skyzen.careers.integration.docusign;

import java.time.Instant;

/**
 * Trimmed projection of DocuSign's envelope responses. Used by both the
 * create flow and the lighter status-poll flow; fields irrelevant to a given
 * caller are simply null.
 */
public record EnvelopeResponse(
        String envelopeId,
        String status,
        Instant statusChangedAt,
        String uri
) {}
