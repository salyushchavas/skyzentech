package com.skyzen.careers.entity;

import com.skyzen.careers.enums.CompensationFrequency;
import com.skyzen.careers.enums.OfferStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(
        name = "offers",
        indexes = {
                @Index(name = "idx_offer_application", columnList = "application_id"),
                @Index(name = "idx_offer_status_expires", columnList = "status, expires_at"),
                @Index(name = "idx_offer_created_at", columnList = "created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Offer {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Column(name = "compensation_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal compensationAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "compensation_frequency", nullable = false)
    private CompensationFrequency compensationFrequency;

    @Column(name = "compensation_currency", nullable = false, length = 3)
    @Builder.Default
    private String compensationCurrency = "USD";

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "expected_end_date")
    private LocalDate expectedEndDate;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private OfferStatus status = OfferStatus.DRAFT;

    @Column(name = "additional_terms", columnDefinition = "TEXT")
    private String additionalTerms;

    @Column(name = "letter_content", columnDefinition = "TEXT", nullable = false)
    private String letterContent;

    @Column(name = "decline_reason", columnDefinition = "TEXT")
    private String declineReason;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoked_by")
    private UUID revokedBy;

    // ── Phase 3 — DocuSign + offer-letter doc-spec fields ───────────────────

    /** DocuSign envelope id; null while in DRAFT or in NO-OP mode. UNIQUE. */
    @Column(name = "docusign_envelope_id", length = 80, unique = true)
    private String docusignEnvelopeId;

    /** DocuSign template id used (mirrors {@code docusign.template-id} at send time). */
    @Column(name = "docusign_template_id", length = 80)
    private String docusignTemplateId;

    /** Set by the DocuSign webhook when status flips to SIGNED. */
    @Column(name = "signed_at")
    private Instant signedAt;

    @Column(name = "voided_at")
    private Instant voidedAt;

    /** Min 10 chars at controller layer; staff-only in applicant DTOs. */
    @Column(name = "voided_reason", columnDefinition = "TEXT")
    private String voidedReason;

    /** Role name shown in the letter. */
    @Column(name = "role_title", length = 200)
    private String roleTitle;

    /** Free-text compensation summary that appears via the template merge. */
    @Column(name = "compensation_summary", length = 500)
    private String compensationSummary;

    @Column(name = "worksite", length = 200)
    private String worksite;

    @Column(name = "expected_hours_per_week")
    private Integer expectedHoursPerWeek;

    /** Archive of the signed PDF in {@code documents} (category=SIGNED_OFFER). */
    @Column(name = "signed_pdf_document_id")
    private UUID signedPdfDocumentId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
