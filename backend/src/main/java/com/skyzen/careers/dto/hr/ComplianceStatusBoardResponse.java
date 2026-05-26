package com.skyzen.careers.dto.hr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Six-stage compliance status board — the canonical post-hire flow:
 *
 * <pre>
 *   offerAccepted     candidates with an accepted offer whose compliance
 *                     work hasn't started yet (engagement = PENDING_COMPLIANCE)
 *   i983InProgress    I-983 plans currently moving — anything in DRAFT,
 *                     COMPLETE, SUBMITTED_TO_DSO, or AMENDMENT_REQUESTED
 *   i9Section1Pending I-9 forms in NOT_STARTED (candidate hasn't signed §1)
 *   i9Section2Pending I-9 forms in SECTION_2_PENDING / SECTION_1_COMPLETE
 *                     (HR needs to enter §2)
 *   everifyOpen       E-Verify cases in PENDING_SUBMISSION or OPEN
 *   cleared           engagements in ACTIVE — all compliance done, intern is
 *                     working
 * </pre>
 *
 * The counts are NOT mutually exclusive: a single candidate might appear in
 * "i9Section2Pending" AND "i983InProgress" at the same time. The board is an
 * indicator panel, not a single-state funnel.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComplianceStatusBoardResponse {
    private long offerAccepted;
    private long i983InProgress;
    private long i9Section1Pending;
    private long i9Section2Pending;
    private long everifyOpen;
    private long cleared;
}
