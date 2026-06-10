package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * ERM Phase 8 — central library of reusable document templates ERM picks
 * from when assembling per-intern packets. The actual PDF / DOCX file
 * lives in the {@code documents} vault (encrypted at rest when the
 * sensitivity tag warrants it); this entity carries metadata + version
 * + file pointer.
 *
 * <p>{@code title} is unique so seeded titles ("W-4 2026", "I-9 Form
 * 2026", etc.) survive repeat boots idempotently.</p>
 */
@Entity
@Table(name = "document_templates", indexes = {
        @Index(name = "idx_document_templates_cat_active",
                columnList = "category, is_active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentTemplate {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "title", nullable = false, length = 200, unique = true)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /** TAX | IMMIGRATION | EMPLOYMENT | LEGAL | COMPLIANCE | INFORMATIONAL | OTHER */
    @Column(name = "category", nullable = false, length = 40)
    private String category;

    /** Null until ERM uploads via /api/v1/erm/document-templates/{id}/file. */
    @Column(name = "template_file_id")
    private UUID templateFileId;

    /** PDF | DOCX | XLSX | OTHER */
    @Column(name = "file_kind", nullable = false, length = 20)
    @Builder.Default
    private String fileKind = "PDF";

    /** Mirrors {@code Document.sensitivity} — drives encryption of the
     *  intern's uploaded counterpart when they return the filled file. */
    @Column(name = "sensitivity", nullable = false, length = 40)
    @Builder.Default
    private String sensitivity = "NORMAL";

    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(name = "previous_version_file_id")
    private UUID previousVersionFileId;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = Boolean.TRUE;

    @Column(name = "instructions", columnDefinition = "TEXT")
    private String instructions;

    @Column(name = "created_by_id", nullable = false)
    private UUID createdById;

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
