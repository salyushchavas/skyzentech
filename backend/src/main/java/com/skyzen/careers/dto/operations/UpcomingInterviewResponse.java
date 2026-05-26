package com.skyzen.careers.dto.operations;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * One row in the upcoming-interviews list. Only the bits the dashboard needs;
 * no candidate PII beyond name + position. {@code id} deep-links to the staff
 * interview detail page; {@code applicationId} deep-links to the application
 * the interview belongs to.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpcomingInterviewResponse {
    private UUID id;
    private UUID applicationId;
    private String candidateName;
    private String position;
    private Instant scheduledAt;
    private String type;
    private String interviewerName;
}
