package com.skyzen.careers.dto.operations;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * One row in the onboarding queue. Operations sees the engagement's coarse
 * phase ({@link com.skyzen.careers.enums.EngagementStatus}) and a count of
 * pending tasks — never the underlying compliance state (I-9 status, I-983
 * status, E-Verify case). Those live behind the HR / compliance dashboards.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OnboardingQueueItemResponse {
    private UUID engagementId;
    private UUID candidateId;
    private String candidateName;
    private String position;
    private String status;
    private int pendingTaskCount;
}
