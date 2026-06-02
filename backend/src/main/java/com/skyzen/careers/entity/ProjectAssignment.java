package com.skyzen.careers.entity;

import com.skyzen.careers.enums.ProjectAssignmentStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Per-(project, intern) assignment row in the new Project Catalog model.
 *
 * <p>A {@link Project} is the catalog/template item (one-to-many to
 * assignments). Re-assigning the same project to the same intern inserts
 * a NEW row — old rows are preserved as history. No unique constraint on
 * (project_id, intern_id).</p>
 *
 * <h2>Coexistence with the legacy single-allocation model</h2>
 * The pre-existing {@link Project} entity still carries
 * {@code intern_id / status / due_date / etc.} for the legacy
 * single-allocation flow (workspace + submission + project-workflow). New
 * catalog projects don't populate those columns; only assignments populate
 * {@code project_assignments}. Backfill in
 * {@code SchemaFixupRunner} mints one assignment row per existing
 * intern-bearing Project so legacy data is reachable through the new
 * surface too.
 */
@Entity
@Table(
        name = "project_assignments",
        indexes = {
                @Index(name = "idx_pa_intern", columnList = "intern_id"),
                @Index(name = "idx_pa_project", columnList = "project_id"),
                @Index(name = "idx_pa_assigned_by", columnList = "assigned_by_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectAssignment {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    /** users.id of the intern this assignment is for. */
    @Column(name = "intern_id", nullable = false)
    private UUID internId;

    /** users.id of the TE who created the assignment. */
    @Column(name = "assigned_by_id", nullable = false)
    private UUID assignedById;

    @Column(name = "assignment_date", nullable = false)
    private LocalDate assignmentDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    @Builder.Default
    private ProjectAssignmentStatus status = ProjectAssignmentStatus.ASSIGNED;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
