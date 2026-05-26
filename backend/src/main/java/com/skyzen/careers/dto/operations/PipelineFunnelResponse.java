package com.skyzen.careers.dto.operations;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Five-stage funnel as seen by Operations. The same stage bands the candidate
 * dashboard uses, but counted across ALL applications rather than scoped to
 * one candidate.
 *
 * <ul>
 *   <li>applied — {@code APPLIED} only</li>
 *   <li>screening — {@code SCREENING_SENT}, {@code SCREENING_COMPLETED}, {@code SHORTLISTED}</li>
 *   <li>interview — {@code INTERVIEW_SCHEDULED}, {@code INTERVIEWED}</li>
 *   <li>offer — {@code SELECTED_CONDITIONAL}, {@code OFFERED}, {@code ACCEPTED}</li>
 *   <li>onboarding — engagements in {@code PENDING_COMPLIANCE} or {@code READY_TO_START}</li>
 * </ul>
 *
 * Exit statuses (REJECTED / WITHDRAWN / LAPSED / NO_SHOW / engagement COMPLETED
 * / TERMINATED) are intentionally NOT in the funnel — they're not in flight.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PipelineFunnelResponse {
    private long applied;
    private long screening;
    private long interview;
    private long offer;
    private long onboarding;
}
