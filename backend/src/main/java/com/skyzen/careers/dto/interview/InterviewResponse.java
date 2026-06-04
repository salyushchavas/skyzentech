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
    /** Phase 2.2 scorecard dimension; null for legacy rows submitted via /feedback. */
    private Integer feedbackProblemSolvingRating;
    private String feedbackStrengths;
    private String feedbackConcerns;
    /** Phase 2.2 unified scorecard comments; legacy rows use strengths/concerns. */
    private String feedbackComments;
    private InterviewRecommendation feedbackRecommendation;
    private Instant feedbackSubmittedAt;
    private String feedbackSubmittedByName;
    private Instant createdAt;
    private String createdByName;

    // ── Phase 2 doc-spec fields ─────────────────────────────────────────────
    //
    // This DTO is ERM-facing (returned by GET /api/v1/interviews + /{id} when
    // caller is ERM/MANAGER/SUPER_ADMIN); applicants get CandidateInterviewResponse
    // which omits zoom_start_url + internal_notes.

    private String timezone;
    private Long zoomMeetingId;
    private String zoomJoinUrl;
    /** HOST-ONLY — populated only when the caller is ERM/MANAGER/SUPER_ADMIN. */
    private String zoomStartUrl;
    private String zoomPassword;
    /** SELECTED | HOLD | REJECTED — null until /complete is called. */
    private String decision;
    /** Applicant-safe outcome message. */
    private String applicantVisibleNotes;
    /** ERM/manager-only notes — populated only for staff callers. */
    private String internalNotes;
    private String prepInstructions;
}
