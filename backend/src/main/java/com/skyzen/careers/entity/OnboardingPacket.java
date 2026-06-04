package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Phase 4 onboarding packet. One per user, created when ERM "assigns the
 * packet" after EMPLOYEE_ID_CREATED. Five required items (W-4, I-9 Section 1,
 * ACH, Emergency Contact, Handbook Acknowledgment) + I-983 when the
 * candidate's expected work-auth track is STEM_OPT.
 */
@Entity
@Table(name = "onboarding_packets", indexes = {
        @Index(name = "idx_onboarding_packets_user_id", columnList = "user_id", unique = true),
        @Index(name = "idx_onboarding_packets_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OnboardingPacket {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Column(name = "intern_lifecycle_id", nullable = false, unique = true)
    private UUID internLifecycleId;

    /** ASSIGNED | IN_PROGRESS | IN_REVIEW | ACCEPTED | REJECTED. */
    @Column(name = "status", nullable = false, length = 20,
            columnDefinition = "varchar(20) not null default 'ASSIGNED'")
    @Builder.Default
    private String status = "ASSIGNED";

    @Column(name = "assigned_by_id", nullable = false)
    private UUID assignedById;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.assignedAt == null) this.assignedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
