package com.skyzen.careers.entity;

import com.skyzen.careers.enums.ProjectStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Long-running project workspace — supervisor allocates, intern works,
 * supervisor verifies. Separate from {@link WorkAssignment} (the weekly
 * single-task surface) because the Project lifecycle is richer:
 *
 * <ul>
 *   <li>Multiple submissions (history kept in {@link ProjectSubmission})</li>
 *   <li>Checklist for progress tracking ({@link ProjectTask})</li>
 *   <li>Split review outcome — {@code RETURNED} (resubmit) vs
 *       {@code COMPLETED} (terminal lock)</li>
 * </ul>
 *
 * <h2>Lifecycle</h2>
 * <pre>
 *   create (supervisor)        → NOT_STARTED
 *   /start (intern)            → IN_PROGRESS (stamp started_at)
 *   /progress (intern)         → no status change; updates progress_pct
 *   /submit (intern)           → SUBMITTED (stamp submitted_at; write a
 *                                 ProjectSubmission row)
 *   /return (supervisor)       → RETURNED (stamp reviewed_at; review_notes required)
 *   /submit (intern) again     → SUBMITTED (next ProjectSubmission row)
 *   /complete (supervisor)     → COMPLETED (terminal; stamp completed_at)
 * </pre>
 *
 * <h2>Supervisor scoping</h2>
 * The owning supervisor is on the {@link Engagement#getSupervisor()}, not
 * directly on the project. The service-layer gate resolves the engagement's
 * supervisor at action time; SUPER_ADMIN bypasses.
 */
@Entity
@Table(
        name = "projects",
        indexes = {
                @Index(name = "idx_project_intern_status", columnList = "intern_id, status"),
                @Index(name = "idx_project_engagement", columnList = "engagement_id"),
                @Index(name = "idx_project_status_due", columnList = "status, due_date")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Project {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 200)
    private String title;

    /** Brief / context — what the project is about. */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** What the intern is expected to produce. Separate from description. */
    @Column(columnDefinition = "TEXT")
    private String deliverables;

    /** JSON-encoded {@code List<String>} of resource URLs given at allocation. */
    @Column(name = "resource_links_json", columnDefinition = "TEXT")
    private String resourceLinksJson;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "engagement_id", nullable = false)
    private Engagement engagement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "intern_id", nullable = false)
    private Candidate intern;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assigned_by", nullable = false)
    private User assignedBy;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private ProjectStatus status = ProjectStatus.NOT_STARTED;

    /**
     * 0–100. Updated by the intern via /progress. Independent from the task
     * checklist count — the UI can drive either explicitly or via tasks-done
     * percentage; the service trusts whatever the intern sends, clamped.
     */
    @Column(name = "progress_pct", nullable = false)
    @Builder.Default
    private Integer progressPct = 0;

    /** Reviewer's most recent feedback note (required on RETURN; optional on COMPLETE). */
    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    /** Most-recent submission timestamp (re-stamped on each resubmit). */
    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    // ── Catalog fields (additive — populated by the new Project Catalog +
    //    Assignment module; legacy single-allocation paths leave these
    //    null and continue to read title / description / deliverables /
    //    resourceLinksJson as before).

    /** Catalog name. Falls back to {@link #title} for legacy rows. */
    @Column(name = "name", length = 200)
    private String name;

    /** Free-text tech stack — comma-separated tokens or short summary. */
    @Column(name = "tech_stack", length = 500)
    private String techStack;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(name = "difficulty", length = 20)
    private com.skyzen.careers.enums.Difficulty difficulty;

    @Column(name = "expected_duration_days")
    private Integer expectedDurationDays;

    @Column(name = "instructions", columnDefinition = "TEXT")
    private String instructions;

    /** TE who created the catalog entry (distinct from {@link #assignedBy}). */
    @Column(name = "created_by_id")
    private java.util.UUID createdById;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
