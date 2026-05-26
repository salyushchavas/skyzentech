package com.skyzen.careers.dto.hr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One row in the read-only compliance audit feed. Carries a pre-rendered
 * {@code summary} string identical in format to the one produced by
 * {@link com.skyzen.careers.service.ComplianceOverviewService} — no raw
 * before/after JSON, no PII, no IP address. The frontend renders it as a
 * static feed; there's no export or download control attached.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditFeedItemResponse {
    private Instant timestamp;
    private String summary;
    private String entityType;
    private String linkUrl;
}
