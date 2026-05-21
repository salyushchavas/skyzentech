package com.skyzen.careers.entity;

import com.skyzen.careers.enums.UserRole;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String fullName;

    private String phoneNumber;

    @ElementCollection(targetClass = UserRole.class, fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    @Builder.Default
    private Set<UserRole> roles = new HashSet<>();

    /**
     * Active accounts can log in; deactivated accounts are rejected at the
     * auth layer. Defaults to TRUE for new users. The Postgres column has
     * {@code NOT NULL DEFAULT TRUE} so existing rows backfill cleanly when
     * the column is first added (see {@code SchemaFixupRunner}).
     */
    @Column(nullable = false, columnDefinition = "boolean not null default true")
    @Builder.Default
    private Boolean active = true;

    /**
     * Email-verification gate. New CANDIDATE registrations start FALSE; verified
     * via the 6-digit code in {@code emailVerificationCode}. Existing rows are
     * backfilled to TRUE on first boot (see {@code SchemaFixupRunner} —
     * column added with {@code DEFAULT TRUE}). Openings + apply require this
     * to be TRUE for CANDIDATE callers (phase 1.3 gate).
     */
    @Column(name = "email_verified", nullable = false,
            columnDefinition = "boolean not null default false")
    @Builder.Default
    private Boolean emailVerified = false;

    /** 6-digit code; nullable after verification succeeds. */
    @Column(name = "email_verification_code")
    private String emailVerificationCode;

    @Column(name = "email_verification_sent_at")
    private Instant emailVerificationSentAt;

    @Column(name = "email_verification_expires_at")
    private Instant emailVerificationExpiresAt;

    /**
     * Skyzen Applicant ID, format {@code SKZ-INT-YYYY-NNNNNN} where NNNNNN
     * is zero-padded from a Postgres sequence ({@code skyzen_applicant_seq}).
     * Issued on first email-verification for CANDIDATE accounts; staff don't
     * receive one. Unique across the entire users table.
     */
    @Column(name = "applicant_id", unique = true, length = 32)
    private String applicantId;

    @Column(name = "applicant_id_created_at")
    private Instant applicantIdCreatedAt;

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
