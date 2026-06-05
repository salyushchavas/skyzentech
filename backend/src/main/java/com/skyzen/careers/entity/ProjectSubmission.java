package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * One row per {@code /submit} on a {@link Project}. Keeps the resubmission
 * history so the supervisor can see what changed between rounds and so the
 * intern can re-read what they sent last time after a RETURNED bounce.
 */
@Entity
@Table(
        name = "project_submissions",
        indexes = {
                @Index(name = "idx_project_submission_project",
                        columnList = "project_id, submitted_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectSubmission {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    /** Intern's note for this submission — what they did this round. */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** JSON-encoded {@code List<String>} of deliverable links (PR, deploy URL, docs). */
    @Column(name = "links_json", columnDefinition = "TEXT")
    private String linksJson;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private Instant submittedAt;

    // ── Trainer Phase 0 — doc Feedback Form columns ────────────────────────
    // Phase 3 will populate these via the dedicated review service; Phase 0
    // just adds the columns so the schema is doc-compliant.

    /** Doc Feedback Form "Technical quality score" — 1-5. */
    @Column(name = "technical_score")
    private Short technicalScore;

    /** Doc Feedback Form "Communication / clarity" — 1-5. */
    @Column(name = "communication_score")
    private Short communicationScore;

    /** Doc Feedback Form "Blockers" textarea. */
    @Column(name = "blockers_note", columnDefinition = "TEXT")
    private String blockersNote;

    /** Doc Feedback Form "Next action" dropdown —
     *  REVISION | NEXT_PROJECT | EXTRA_TRAINING | ESCALATION. */
    @Column(name = "next_action", length = 40)
    private String nextAction;

    @Column(name = "next_action_due_date")
    private java.time.LocalDate nextActionDueDate;

    /** Doc Feedback Form "Attachments / reviewed links" — external URLs
     *  (e.g. GitHub PR links). Internal document ids go through the
     *  existing attached_document_ids JSONB column added in Phase 5. */
    @Column(name = "reviewed_links_csv", columnDefinition = "TEXT")
    private String reviewedLinksCsv;

    @PrePersist
    void onCreate() {
        if (submittedAt == null) submittedAt = Instant.now();
    }
}
