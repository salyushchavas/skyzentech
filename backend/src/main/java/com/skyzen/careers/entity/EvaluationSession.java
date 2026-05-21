package com.skyzen.careers.entity;

import com.skyzen.careers.enums.EvaluationSessionStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "evaluation_sessions",
        indexes = {
                @Index(name = "idx_eval_session_intern", columnList = "intern_id"),
                @Index(name = "idx_eval_session_evaluator", columnList = "evaluator_id"),
                @Index(name = "idx_eval_session_status_scheduled", columnList = "status, scheduled_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvaluationSession {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "intern_id", nullable = false)
    private Candidate intern;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluator_id")
    private User evaluator;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private EvaluationSessionStatus status = EvaluationSessionStatus.SCHEDULED;

    @Column(name = "overall_rating")
    private Integer overallRating;

    @Column(columnDefinition = "TEXT")
    private String strengths;

    @Column(name = "areas_for_improvement", columnDefinition = "TEXT")
    private String areasForImprovement;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }
}
