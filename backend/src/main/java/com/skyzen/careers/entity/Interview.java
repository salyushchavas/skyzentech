package com.skyzen.careers.entity;

import com.skyzen.careers.enums.InterviewRecommendation;
import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.enums.InterviewType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "interviews",
        indexes = {
                @Index(name = "idx_interview_application", columnList = "application_id"),
                @Index(name = "idx_interview_interviewer_scheduled", columnList = "interviewer_id, scheduled_at"),
                @Index(name = "idx_interview_status_scheduled", columnList = "status, scheduled_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Interview {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "interviewer_id", nullable = false)
    private User interviewer;

    @Column(name = "scheduled_at", nullable = false)
    private Instant scheduledAt;

    @Column(name = "duration_minutes", nullable = false)
    @Builder.Default
    private Integer durationMinutes = 60;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InterviewType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private InterviewStatus status = InterviewStatus.SCHEDULED;

    @Column(name = "meeting_url", length = 500)
    private String meetingUrl;

    @Column(name = "candidate_notes", columnDefinition = "TEXT")
    private String candidateNotes;

    // ── Phase 2: Zoom + applicant-safe outcome fields ───────────────────────
    //
    // zoom_start_url is HOST-ONLY — never returned to applicants. See the
    // applicant-safe DTO mapper in InterviewController.

    /** IANA timezone (e.g. "America/New_York"). Defaults to UTC. */
    @Column(name = "timezone", nullable = false, length = 50,
            columnDefinition = "varchar(50) not null default 'UTC'")
    @Builder.Default
    private String timezone = "UTC";

    /** Zoom meeting numeric id (null when zoom.enabled=false or Zoom call failed). */
    @Column(name = "zoom_meeting_id")
    private Long zoomMeetingId;

    /** Applicant-safe Zoom join URL. */
    @Column(name = "zoom_join_url", columnDefinition = "TEXT")
    private String zoomJoinUrl;

    /** HOST-ONLY Zoom start URL — never serialised to applicants. */
    @Column(name = "zoom_start_url", columnDefinition = "TEXT")
    private String zoomStartUrl;

    @Column(name = "zoom_password", length = 40)
    private String zoomPassword;

    /** SELECTED | HOLD | REJECTED. Set on /complete; null before. */
    @Column(name = "decision", length = 20)
    private String decision;

    /** Doc-spec outcome message shown to the applicant. ≥ 20 chars on complete. */
    @Column(name = "applicant_visible_notes", columnDefinition = "TEXT")
    private String applicantVisibleNotes;

    /** ERM/manager-only notes — NEVER returned to the applicant. */
    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    /** Prep instructions shown to the applicant on the Interview Center hero card. */
    @Column(name = "prep_instructions", columnDefinition = "TEXT")
    private String prepInstructions;

    @Column(name = "feedback_overall_rating")
    private Integer feedbackOverallRating;

    @Column(name = "feedback_technical_rating")
    private Integer feedbackTechnicalRating;

    @Column(name = "feedback_communication_rating")
    private Integer feedbackCommunicationRating;

    /**
     * Phase 2.2 — third dimension in the structured scorecard. 1-5; null when the
     * interviewer skipped it (legacy /feedback rows or before the column existed).
     */
    @Column(name = "feedback_problem_solving_rating")
    private Integer feedbackProblemSolvingRating;

    @Column(name = "feedback_strengths", columnDefinition = "TEXT")
    private String feedbackStrengths;

    @Column(name = "feedback_concerns", columnDefinition = "TEXT")
    private String feedbackConcerns;

    /**
     * Phase 2.2 — unified scorecard comments. The legacy strengths/concerns
     * pair is preserved so existing rows keep rendering; the new /scorecard
     * path writes to this single column.
     */
    @Column(name = "feedback_comments", columnDefinition = "TEXT")
    private String feedbackComments;

    @Enumerated(EnumType.STRING)
    @Column(name = "feedback_recommendation")
    private InterviewRecommendation feedbackRecommendation;

    @Column(name = "feedback_submitted_at")
    private Instant feedbackSubmittedAt;

    @Column(name = "feedback_submitted_by")
    private UUID feedbackSubmittedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
