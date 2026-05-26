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

    @PrePersist
    void onCreate() {
        if (submittedAt == null) submittedAt = Instant.now();
    }
}
