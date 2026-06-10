package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * ERM Phase 8 — one row per (packet, template) combo. Frozen at
 * assignment time: {@code template_snapshot_file_id} +
 * {@code template_snapshot_version} preserve which version of the
 * template the intern was issued, so a later template update doesn't
 * invalidate in-flight tasks.
 *
 * <p>Lifecycle: {@code PENDING → SUBMITTED → UNDER_REVIEW → ACCEPTED |
 * REJECTED | RESEND_REQUESTED}; {@code WAIVED} is the SUPER_ADMIN
 * escape hatch.</p>
 */
@Entity
@Table(name = "document_tasks",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_document_tasks_packet_template",
                columnNames = {"packet_id", "template_id"}),
        indexes = {
                @Index(name = "idx_document_tasks_packet_status",
                        columnList = "packet_id, status"),
                @Index(name = "idx_document_tasks_status_submitted",
                        columnList = "status, submitted_at"),
                @Index(name = "idx_document_tasks_reviewer",
                        columnList = "reviewed_by_id, reviewed_at")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentTask {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "packet_id", nullable = false)
    private UUID packetId;

    @Column(name = "template_id")
    private UUID templateId;

    @Column(name = "template_snapshot_file_id")
    private UUID templateSnapshotFileId;

    @Column(name = "template_snapshot_version")
    private Integer templateSnapshotVersion;

    @Column(name = "task_instructions", columnDefinition = "TEXT")
    private String taskInstructions;

    /** PENDING | SUBMITTED | UNDER_REVIEW | ACCEPTED | REJECTED |
     *  RESEND_REQUESTED | WAIVED. */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "uploaded_file_id")
    private UUID uploadedFileId;

    @Column(name = "download_count", nullable = false)
    @Builder.Default
    private Integer downloadCount = 0;

    @Column(name = "last_downloaded_at")
    private Instant lastDownloadedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by_id")
    private UUID reviewedById;

    @Column(name = "review_reason_code", length = 80)
    private String reviewReasonCode;

    /** Shown verbatim to the intern on REJECT / RESEND_REQUESTED. */
    @Column(name = "review_comments", columnDefinition = "TEXT")
    private String reviewComments;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(name = "waived_at")
    private Instant waivedAt;

    @Column(name = "waived_by_id")
    private UUID waivedById;

    @Column(name = "waived_reason", columnDefinition = "TEXT")
    private String waivedReason;

    /** ERM-only — NEVER returned to INTERN DTOs. */
    @Column(name = "internal_note", columnDefinition = "TEXT")
    private String internalNote;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
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
