package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * One row per item in an onboarding packet (W4, I9, ACH, EMERGENCY_CONTACT,
 * HANDBOOK_ACK, I983). Required typed form data lives in
 * {@link #formDataJson} — encrypted at rest as a single AES-256-GCM envelope
 * via {@link com.skyzen.careers.security.PiiEncryptionService} when the item
 * carries PII. Non-PII forms (handbook acknowledgment, emergency contact)
 * may store the JSON in plaintext if every field is non-sensitive — the
 * service decides on submit per category.
 */
@Entity
@Table(name = "onboarding_items", uniqueConstraints = @UniqueConstraint(
        name = "uk_onboarding_items_packet_category",
        columnNames = {"packet_id", "category"}
), indexes = {
        @Index(name = "idx_onboarding_items_packet", columnList = "packet_id"),
        @Index(name = "idx_onboarding_items_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OnboardingItem {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "packet_id", nullable = false)
    private UUID packetId;

    /** W4 | I9 | ACH | EMERGENCY_CONTACT | HANDBOOK_ACK | I983 */
    @Column(name = "category", nullable = false, length = 40)
    private String category;

    @Column(name = "required", nullable = false,
            columnDefinition = "boolean not null default true")
    @Builder.Default
    private Boolean required = true;

    /** PENDING | SUBMITTED | ACCEPTED | REJECTED | RESEND_REQUESTED */
    @Column(name = "status", nullable = false, length = 20,
            columnDefinition = "varchar(20) not null default 'PENDING'")
    @Builder.Default
    private String status = "PENDING";

    /**
     * Encrypted JSON envelope. For W-4, I-9, and ACH this is base64(IV || ct+tag);
     * for non-PII categories (HANDBOOK_ACK, EMERGENCY_CONTACT) it may be
     * plaintext JSON. Read path always tries decrypt first; falls back to
     * raw read if the value doesn't start with the encrypted-envelope shape.
     */
    @Column(name = "form_data_json", columnDefinition = "TEXT")
    private String formDataJson;

    /** Optional uploaded supporting file (e.g., voided check for ACH). */
    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by_id")
    private UUID reviewedById;

    /** Surfaced to the applicant on REJECTED / RESEND_REQUESTED. */
    @Column(name = "erm_comments", columnDefinition = "TEXT")
    private String ermComments;

    /** ERM-only — never returned to the applicant. */
    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(name = "version", nullable = false,
            columnDefinition = "integer not null default 1")
    @Builder.Default
    private Integer version = 1;

    // ── ERM Phase 5 — review headline + audit denorm ───────────────────────
    // The full immutable history lives on onboarding_review_logs; these
    // columns mirror the latest decision so the queue rows don't have to
    // join the log table for the common "show me the last reason" need.

    @Column(name = "last_reviewed_at")
    private Instant lastReviewedAt;

    @Column(name = "last_reviewed_by_id")
    private UUID lastReviewedById;

    @Column(name = "last_review_reason_code", length = 80)
    private String lastReviewReasonCode;

    /** ERM-only structured free-text reason. NEVER returned to INTERN. */
    @Column(name = "last_review_reason_text", columnDefinition = "TEXT")
    private String lastReviewReasonText;

    @Column(name = "review_count", nullable = false,
            columnDefinition = "integer not null default 0")
    @Builder.Default
    private Integer reviewCount = 0;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
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
