package com.skyzen.careers.dto.interview;

import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.InterviewRecommendation;
import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.enums.InterviewType;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewResponse {
    private UUID id;
    private UUID applicationId;
    private ApplicationStatus applicationStatus;
    private String candidateName;
    private String candidateEmail;
    private String jobPostingTitle;
    private String interviewerName;
    private UUID interviewerId;
    private Instant scheduledAt;
    private Integer durationMinutes;
    private InterviewType type;
    private InterviewStatus status;
    private String meetingUrl;
    private String candidateNotes;
    private Integer feedbackOverallRating;
    private Integer feedbackTechnicalRating;
    private Integer feedbackCommunicationRating;
    private String feedbackStrengths;
    private String feedbackConcerns;
    private InterviewRecommendation feedbackRecommendation;
    private Instant feedbackSubmittedAt;
    private String feedbackSubmittedByName;
    private Instant createdAt;
    private String createdByName;
}
