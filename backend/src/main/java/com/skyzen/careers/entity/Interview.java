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

    @Column(name = "feedback_overall_rating")
    private Integer feedbackOverallRating;

    @Column(name = "feedback_technical_rating")
    private Integer feedbackTechnicalRating;

    @Column(name = "feedback_communication_rating")
    private Integer feedbackCommunicationRating;

    @Column(name = "feedback_strengths", columnDefinition = "TEXT")
    private String feedbackStrengths;

    @Column(name = "feedback_concerns", columnDefinition = "TEXT")
    private String feedbackConcerns;

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
