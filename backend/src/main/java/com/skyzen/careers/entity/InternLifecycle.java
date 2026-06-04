package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Skeletal placeholder entity for the post-hire intern's permanent home
 * record. Per the Applicant-to-Intern Lifecycle doc, this row is created at
 * the EMPLOYEE_ID_CREATED transition and carries the long-lived
 * assignments (trainer, evaluator, reporting manager, ERM) the intern is
 * paired with.
 *
 * <p>Phase 0 creates the schema only; Phase 1 wires it into the dashboard
 * endpoint. Pure UUID references — no JPA relations yet, to keep the
 * blast radius zero until the surrounding services are rebuilt.</p>
 */
@Entity
@Table(name = "intern_lifecycles", indexes = {
        @Index(name = "idx_intern_lifecycles_employee_id", columnList = "employee_id", unique = true),
        @Index(name = "idx_intern_lifecycles_user_id", columnList = "user_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InternLifecycle {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "employee_id", nullable = false, length = 40, unique = true)
    private String employeeId;

    /**
     * Phase 3 — the User this lifecycle row belongs to. UNIQUE per user;
     * inserted once at the OFFER_SIGNED webhook moment and never reassigned.
     */
    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Column(name = "active_status", nullable = false, length = 24,
            columnDefinition = "varchar(24) not null default 'PROSPECTIVE'")
    @Builder.Default
    private String activeStatus = "PROSPECTIVE";

    @Column(name = "trainer_id")
    private UUID trainerId;

    @Column(name = "evaluator_id")
    private UUID evaluatorId;

    @Column(name = "manager_id")
    private UUID managerId;

    @Column(name = "erm_id")
    private UUID ermId;

    /** Phase 3 — moment OFFER_SIGNED webhook fired. */
    @Column(name = "hired_at", nullable = false)
    private Instant hiredAt;

    /** Phase 4 — set when ERM marks onboarding accepted + start date reached. */
    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.hiredAt == null) this.hiredAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
