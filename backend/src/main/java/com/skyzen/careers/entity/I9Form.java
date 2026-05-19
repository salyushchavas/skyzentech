package com.skyzen.careers.entity;

import com.skyzen.careers.enums.CitizenshipStatus;
import com.skyzen.careers.enums.I9Status;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(
        name = "i9_forms",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_i9_candidate",
                columnNames = "candidate_id"
        ),
        indexes = {
                @Index(name = "idx_i9_status", columnList = "status"),
                @Index(name = "idx_i9_first_day", columnList = "first_day_of_employment")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class I9Form {

    // ── Identity ────────────────────────────────────────────────────────────

    @Id
    @GeneratedValue
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false, unique = true)
    private Candidate candidate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private I9Status status = I9Status.NOT_STARTED;

    // ── Section 1 ───────────────────────────────────────────────────────────

    @Column(length = 80)
    private String lastName;

    @Column(length = 80)
    private String firstName;

    @Column(length = 4)
    private String middleInitial;

    @Column(length = 200)
    private String otherLastNamesUsed;

    @Column(length = 200)
    private String addressStreet;

    @Column(length = 20)
    private String addressAptNumber;

    @Column(length = 80)
    private String addressCity;

    @Column(length = 4)
    private String addressState;

    @Column(length = 10)
    private String addressZipCode;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    /**
     * SSN in XXX-XX-XXXX format. Stored as plain string for v1; encryption is
     * a Sprint 4 follow-up. Never log this field.
     */
    @Column(length = 11)
    private String ssn;

    @Column(length = 120)
    private String email;

    @Column(length = 20)
    private String phoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "citizenship_status")
    private CitizenshipStatus citizenshipStatus;

    @Column(length = 20)
    private String alienRegistrationNumber;

    @Column(length = 30)
    private String foreignPassportNumber;

    @Column(length = 80)
    private String foreignPassportCountry;

    @Column(name = "work_auth_expiration_date")
    private LocalDate workAuthExpirationDate;

    @Column(name = "preparer_translator_used", nullable = false)
    @Builder.Default
    private Boolean preparerTranslatorUsed = false;

    @Column(name = "section1_signed_at")
    private Instant section1SignedAt;

    @Column(name = "section1_signed_by_name", length = 160)
    private String section1SignedByName;

    // ── Section 2 ───────────────────────────────────────────────────────────

    @Column(name = "first_day_of_employment")
    private LocalDate firstDayOfEmployment;

    @Column(name = "list_a_title", length = 80)
    private String listATitle;

    @Column(name = "list_a_issuing_authority", length = 120)
    private String listAIssuingAuthority;

    @Column(name = "list_a_document_number", length = 60)
    private String listADocumentNumber;

    @Column(name = "list_a_expiration_date")
    private LocalDate listAExpirationDate;

    @Column(name = "list_b_title", length = 80)
    private String listBTitle;

    @Column(name = "list_b_issuing_authority", length = 120)
    private String listBIssuingAuthority;

    @Column(name = "list_b_document_number", length = 60)
    private String listBDocumentNumber;

    @Column(name = "list_b_expiration_date")
    private LocalDate listBExpirationDate;

    @Column(name = "list_c_title", length = 80)
    private String listCTitle;

    @Column(name = "list_c_issuing_authority", length = 120)
    private String listCIssuingAuthority;

    @Column(name = "list_c_document_number", length = 60)
    private String listCDocumentNumber;

    @Column(name = "additional_information", columnDefinition = "TEXT")
    private String additionalInformation;

    @Column(name = "employer_name", length = 160)
    private String employerName;

    @Column(name = "employer_title", length = 120)
    private String employerTitle;

    @Column(name = "business_organization_name", length = 200)
    private String businessOrganizationName;

    @Column(name = "business_address", columnDefinition = "TEXT")
    private String businessAddress;

    @Column(name = "section2_signed_at")
    private Instant section2SignedAt;

    @Column(name = "section2_signed_by_user_id")
    private UUID section2SignedByUserId;

    // ── Section 3 (reserved for v2) ─────────────────────────────────────────

    @Column(name = "section3_signed_at")
    private Instant section3SignedAt;

    @Column(name = "section3_signed_by_user_id")
    private UUID section3SignedByUserId;

    // ── Audit fields ────────────────────────────────────────────────────────

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;
}
