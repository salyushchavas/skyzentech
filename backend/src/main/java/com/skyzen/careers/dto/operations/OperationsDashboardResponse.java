package com.skyzen.careers.dto.operations;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Aggregate payload for the Operations dashboard.
 *
 * <h2>Deliberately absent</h2>
 * No compliance PII (no I-9 / I-983 / E-Verify state, no SSN/document numbers,
 * no work-auth track). No super-admin data (no user management, no audit-log
 * downloads). Operations sees pipeline + queues + counts only.
 *
 * <h2>Comms</h2>
 * No recent-communications block exists yet because no comms/email log entity
 * exists in the codebase. When one is added, the field can be appended without
 * a contract break.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OperationsDashboardResponse {

    /** Caller's display name, for the greeting. */
    private String operatorName;

    private PipelineFunnelResponse pipeline;

    /** Action items waiting on Operations — labelled, counted, deep-linked. */
    private List<ActionItemResponse> needsAttention;

    private List<UpcomingInterviewResponse> upcomingInterviews;

    /**
     * Count of interviews whose scheduled time has passed but the scorecard
     * isn't submitted yet. Used as the headline metric next to the interview
     * queue — Operations chases these down even though the interviewer files
     * the actual scorecard.
     */
    private long pendingScorecards;

    private List<OnboardingQueueItemResponse> onboardingQueue;

    private List<RecentApplicationResponse> recentApplications;

    private List<OpenPostingResponse> openPostings;
}
