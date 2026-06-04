package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Skeletal placeholder entity for the onboarding packet ERM ships to a new
 * hire. Per the Applicant-to-Intern Lifecycle doc, this row is created at
 * the ONBOARDING_ASSIGNED transition and tracks completion of the document
 * requirements bundle before the intern flips to ACTIVE_INTERN.
 *
 * <p>Phase 0 creates the schema only; Phase 4 wires it into the
 * onboarding flow. Pure UUID references — no JPA relations yet, to keep
 * the blast radius zero until the surrounding services are rebuilt.</p>
 *
 * <p>{@code documentRequirementsJson} stores the requirement bundle as a
 * JSON array of {label, type, required, status} entries to avoid coupling
 * Phase 0 to a final schema design.</p>
 */
@Entity
@Table(name = "onboarding_packets", indexes = {
        @Index(name = "idx_onboarding_packets_employee_id", columnList = "employee_id")
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

    @Column(name = "employee_id", nullable = false, length = 40)
    private String employeeId;

    @Column(name = "document_requirements", columnDefinition = "TEXT")
    private String documentRequirementsJson;

    @Column(name = "completion_status", nullable = false, length = 32,
            columnDefinition = "varchar(32) not null default 'PENDING'")
    @Builder.Default
    private String completionStatus = "PENDING";

    @Column(name = "erm_review_status", nullable = false, length = 32,
            columnDefinition = "varchar(32) not null default 'AWAITING'")
    @Builder.Default
    private String ermReviewStatus = "AWAITING";

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
