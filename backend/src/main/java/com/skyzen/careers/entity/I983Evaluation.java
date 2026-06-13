package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Evaluator Phase 0 — STEM OPT I-983 evaluations live in a dedicated table,
 * separate from {@link InternEvaluation}, per the locked design decision
 * that I-983 forms use a distinct schema, cadence, and fan-out from the
 * monthly evaluation flow.
 *
 * <p>The actual business workflow ships in Evaluator Phase 3. Phase 0 only
 * scaffolds the entity, repository, and an idempotent table create in
 * {@code SchemaFixupRunner.ensureEvaluatorPhase0SchemaV1}.</p>
 *
 * <p>FK references are intentionally loose (raw UUIDs, no JPA mapping) so
 * Phase 0 doesn't introduce bidirectional joins with {@link InternLifecycle}
 * or {@link I983Plan}; those can be tightened later if a query needs them.</p>
 */
@Entity
@Table(
        name = "i983_evaluations",
        indexes = {
                @Index(name = "idx_i983_eval_lifecycle_status",
                        columnList = "intern_lifecycle_id, status"),
                @Index(name = "idx_i983_eval_evaluator_status",
                        columnList = "evaluator_id, status")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class I983Evaluation {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "intern_lifecycle_id", nullable = false)
    private UUID internLifecycleId;

    /** FK to {@code i983_plans.id}. Loose reference — no JPA mapping. */
    @Column(name = "i983_plan_id")
    private UUID i983PlanId;

    @Column(name = "evaluator_id", nullable = false)
    private UUID evaluatorId;

    /** Federal cadence is typically 6 months; period bounds are Phase 3 work. */
    @Column(name = "period_start_date")
    private LocalDate periodStartDate;

    @Column(name = "period_end_date")
    private LocalDate periodEndDate;

    /**
     * Coarse classification. Phase 0 placeholder values:
     * {@code INITIAL_PLAN | ANNUAL_REVIEW | FINAL_REVIEW}. Phase 3 will
     * refine and may add CONCLUDING_REPORT etc. Stored as plain VARCHAR
     * so the enum can evolve without a Hibernate ddl-auto stall.
     */
    @Column(name = "evaluation_type", length = 32)
    private String evaluationType;

    /**
     * Mirrors {@link InternEvaluation} status set for cross-entity consistency:
     * {@code SCHEDULED | IN_PROGRESS | PUBLISHED | ACKNOWLEDGED | AMENDED}.
     * Default {@code SCHEDULED} since I-983 evaluations are scheduled by
     * the Evaluator (Phase 3) before any work begins.
     */
    @Column(name = "status", nullable = false, length = 24,
            columnDefinition = "varchar(24) not null default 'SCHEDULED'")
    @Builder.Default
    private String status = "SCHEDULED";

    // ── I-983 specific fields (placeholders for Phase 3) ──────────────────

    @Column(name = "training_objectives_progress", columnDefinition = "TEXT")
    private String trainingObjectivesProgress;

    @Column(name = "training_supervision_provided", columnDefinition = "TEXT")
    private String trainingSupervisionProvided;

    @Column(name = "training_evaluation_outcomes", columnDefinition = "TEXT")
    private String trainingEvaluationOutcomes;

    @Column(name = "employer_signature_required", nullable = false,
            columnDefinition = "boolean not null default true")
    @Builder.Default
    private Boolean employerSignatureRequired = true;

    @Column(name = "student_signature_required", nullable = false,
            columnDefinition = "boolean not null default true")
    @Builder.Default
    private Boolean studentSignatureRequired = true;

    @Column(name = "dso_submitted_to_school_at")
    private Instant dsoSubmittedToSchoolAt;

    // ── Audit ─────────────────────────────────────────────────────────────

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    @Column(name = "created_by_id")
    private UUID createdById;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
