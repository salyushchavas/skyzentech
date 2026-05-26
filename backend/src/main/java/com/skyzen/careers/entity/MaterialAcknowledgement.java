package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * GAP_REPORT C1 — proof that an intern reviewed a released {@link WeeklyMaterial}.
 * One row per (material, intern). Acknowledging is idempotent at the service
 * layer — re-clicking returns the existing row's timestamp rather than 409.
 */
@Entity
@Table(
        name = "material_acknowledgements",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_material_ack_material_intern",
                columnNames = {"material_id", "intern_id"}
        ),
        indexes = {
                @Index(name = "idx_material_ack_intern", columnList = "intern_id"),
                @Index(name = "idx_material_ack_material", columnList = "material_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaterialAcknowledgement {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    private WeeklyMaterial material;

    /** The intern (Candidate row, not User). Mirrors WorkAssignment.intern. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "intern_id", nullable = false)
    private Candidate intern;

    @Column(name = "acknowledged_at", nullable = false, updatable = false)
    private Instant acknowledgedAt;

    @PrePersist
    void onCreate() {
        if (acknowledgedAt == null) acknowledgedAt = Instant.now();
    }
}
