package com.skyzen.careers.dto.hr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Aggregate payload for the HR / Compliance command-center dashboard.
 *
 * <h2>PII boundary</h2>
 * Counts + status labels + candidate names only. NO raw SSN, no document
 * numbers (List A/B/C), no A-Number, no DOB, no foreign passport. All of
 * those live encrypted on the I-9 entity and are visible exclusively on the
 * gated detail pages — never on this overview payload.
 *
 * <h2>Audit-download boundary</h2>
 * The {@code auditFeed} is a read-only stream of compliance-relevant events.
 * It carries no controls to export or download — full audit-log export
 * stays on the SUPER_ADMIN admin pages.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HrDashboardResponse {

    /** Caller's display name, for the greeting. */
    private String operatorName;

    private List<HrActionItemResponse> needsAttention;

    private ComplianceStatusBoardResponse statusBoard;

    private List<AuthExpiryItemResponse> authExpiry;

    private OfferStatusSummaryResponse offerStatus;

    private List<AuditFeedItemResponse> auditFeed;
}
