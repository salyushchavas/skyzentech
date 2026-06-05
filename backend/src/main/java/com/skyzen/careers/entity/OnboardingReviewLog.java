package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * ERM Phase 5 — immutable per-decision history for each onboarding item
 * review. Mirrors InterviewEventLog / OfferEventLog / ApplicationDecisionLog.
 */
@Entity
@Table(name = "onboarding_review_logs", indexes = {
        @Index(name = "idx_onb_review_logs_item",
                columnList = "onboarding_item_id, created_at"),
        @Index(name = "idx_onb_review_logs_actor",
                columnList = "actor_user_id, created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OnboardingReviewLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "onboarding_item_id", nullable = false)
    private UUID onboardingItemId;

    @Column(name = "actor_user_id", nullable = false)
    private UUID actorUserId;

    /** ACCEPT | REJECT | RESEND | AUTO_ACCEPT | RE_OPEN | NOTE_ADDED. */
    @Column(name = "decision", nullable = false, length = 20)
    private String decision;

    @Column(name = "reason_code", length = 80)
    private String reasonCode;

    /** ERM-only — never serialised to INTERN. */
    @Column(name = "reason_text", columnDefinition = "TEXT")
    private String reasonText;

    @Column(name = "previous_status", nullable = false, length = 20)
    private String previousStatus;

    @Column(name = "new_status", nullable = false, length = 20)
    private String newStatus;

    /** The applicant-visible comments at decision time. */
    @Column(name = "erm_comments_snapshot", columnDefinition = "TEXT")
    private String ermCommentsSnapshot;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
