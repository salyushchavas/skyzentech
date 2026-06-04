package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Phase 8 — terminal exit record for an intern lifecycle. One row per
 * {@code intern_lifecycles.id} (UNIQUE); created when ERM moves the intern
 * to INACTIVE_INTERN via {@code POST /api/v1/exit/records}. Carries the
 * exit type, date, ERM-visible summary, optional internal notes, and the
 * checklist state (GitHub revocation, documents archived, final-eval link).
 */
@Entity
@Table(name = "exit_records",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_exit_records_lifecycle",
                columnNames = "intern_lifecycle_id"),
        indexes = {
                @Index(name = "idx_exit_records_intern", columnList = "intern_id"),
                @Index(name = "idx_exit_records_type_date",
                        columnList = "exit_type, exit_date"),
                @Index(name = "idx_exit_records_initiator", columnList = "initiated_by_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExitRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "intern_lifecycle_id", nullable = false, unique = true)
    private UUID internLifecycleId;

    /** users.id of the departing intern (denormalised for fast lookup). */
    @Column(name = "intern_id", nullable = false)
    private UUID internId;

    /** COMPLETED | RESIGNED | TERMINATED | EXTENDED. */
    @Column(name = "exit_type", nullable = false, length = 20)
    private String exitType;

    @Column(name = "exit_date", nullable = false)
    private LocalDate exitDate;

    @Column(name = "exit_reason", columnDefinition = "TEXT")
    private String exitReason;

    @Column(name = "initiated_by_id", nullable = false)
    private UUID initiatedById;

    @Column(name = "final_evaluation_id")
    private UUID finalEvaluationId;

    @Column(name = "rehire_eligible", nullable = false)
    @Builder.Default
    private Boolean rehireEligible = Boolean.TRUE;

    @Column(name = "access_revocation_done", nullable = false)
    @Builder.Default
    private Boolean accessRevocationDone = Boolean.FALSE;

    @Column(name = "access_revocation_attempted_at")
    private Instant accessRevocationAttemptedAt;

    @Column(name = "access_revocation_summary", columnDefinition = "TEXT")
    private String accessRevocationSummary;

    @Column(name = "final_documents_archived", nullable = false)
    @Builder.Default
    private Boolean finalDocumentsArchived = Boolean.FALSE;

    /** Shown on the intern's Home / exit-summary page. ERM writes. */
    @Column(name = "intern_visible_summary", columnDefinition = "TEXT")
    private String internVisibleSummary;

    /** ERM-only; never surfaced to the intern via API. */
    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(name = "amended_at")
    private Instant amendedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
