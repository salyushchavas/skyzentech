package com.skyzen.careers.entity;

import com.skyzen.careers.enums.EVerifyClosureReason;
import com.skyzen.careers.enums.EVerifyStatus;
import com.skyzen.careers.enums.PhotoMatchResult;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "everify_cases",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_everify_i9_form",
                columnNames = "i9_form_id"
        ),
        indexes = {
                @Index(name = "idx_everify_status", columnList = "status")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EVerifyCase {

    @Id
    @GeneratedValue
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "i9_form_id", nullable = false, unique = true)
    private I9Form i9Form;

    @Column(name = "case_number", length = 30)
    private String caseNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private EVerifyStatus status = EVerifyStatus.PENDING_SUBMISSION;

    @Column(name = "opened_at")
    private Instant openedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "closure_reason")
    private EVerifyClosureReason closureReason;

    @Column(name = "photo_match_required", nullable = false)
    @Builder.Default
    private Boolean photoMatchRequired = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "photo_match_result")
    private PhotoMatchResult photoMatchResult;

    @Column(name = "additional_verification_required", nullable = false)
    @Builder.Default
    private Boolean additionalVerificationRequired = false;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;
}
