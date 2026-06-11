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

    /**
     * Skyzen Employee ID, minted at the OFFER_SIGNED → EMPLOYEE_ID_CREATED
     * transition (Phase 3). Nullable until that transition fires.
     */
    @Column(name = "employee_id", length = 40)
    private String employeeId;

    /**
     * Position on the applicant-to-intern lifecycle funnel. Single source of
     * truth for the Phase-1 dashboard mode engine. Existing rows are stamped
     * REGISTERED via {@code SchemaFixupRunner}.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "lifecycle_status", nullable = false, length = 40,
            columnDefinition = "varchar(40) not null default 'REGISTERED'")
    @Builder.Default
    private com.skyzen.careers.enums.InternLifecycleStatus lifecycleStatus =
            com.skyzen.careers.enums.InternLifecycleStatus.REGISTERED;

    /**
     * JSON array of nav-item keys this candidate/intern has already opened —
     * used to suppress the "new" badge after the first visit. Additive column
     * (ddl-auto handles it); legacy rows surface as null which the nav
     * service treats as an empty list. Stored as TEXT to keep the entity
     * Hibernate-portable; the service parses with ObjectMapper.
     */
    @Column(name = "seen_nav_items", columnDefinition = "TEXT")
    private String seenNavItemsJson;

    /**
     * Intern's self-provided GitHub username. Used by the project-assignment
     * module: the TE invites this GitHub user as a collaborator on the
     * project repository out-of-band (no GitHub API call from the platform).
     * Stored as a plain string; no token / OAuth state ever stored.
     */
    @Column(name = "github_username", length = 100)
    private String githubUsername;

    /**
     * Zoom email for ERM members who host interviews. Used as the host
     * user id when ZoomService creates a meeting. Null for non-ERM users
     * and for ERM members who haven't been provisioned in Zoom yet.
     */
    @Column(name = "zoom_email", length = 100)
    private String zoomEmail;

    /**
     * Email notification opt-outs. Both default TRUE (opt-in) — transactional
     * emails ignore these flags entirely (per CAN-SPAM + sensibility). Set to
     * FALSE in the user's preferences page to silence reminders / engagement
     * updates respectively.
     */
    @Column(name = "prefs_reminders", nullable = false,
            columnDefinition = "boolean not null default true")
    @Builder.Default
    private Boolean prefsReminders = true;

    @Column(name = "prefs_engagement_updates", nullable = false,
            columnDefinition = "boolean not null default true")
    @Builder.Default
    private Boolean prefsEngagementUpdates = true;

    // ── Trainer Phase 4 — trainer-role preferences ─────────────────────────

    /** Default recurrence on the Schedule Meeting modal — NONE | WEEKLY. */
    @Column(name = "prefs_trainer_default_recurrence", length = 16)
    private String prefsTrainerDefaultRecurrence;

    /** Default duration on the Schedule Meeting modal (minutes). */
    @Column(name = "prefs_trainer_default_duration")
    private Short prefsTrainerDefaultDuration;

    /** Default sort on the Pending Reviews queue — OLDEST | NEWEST | INTERN. */
    @Column(name = "prefs_trainer_review_priority", length = 16)
    private String prefsTrainerReviewPriority;

    /** Default state of the "notify stakeholders" checkbox on the
     *  Project Assignment wizard. */
    @Column(name = "prefs_trainer_notify_stakeholders")
    private Boolean prefsTrainerNotifyStakeholders;

    /** Email frequency for in-app reminders — DAILY | WEEKLY | NEVER. */
    @Column(name = "prefs_trainer_email_frequency", length = 16)
    private String prefsTrainerEmailFrequency;

    /** Notify me when an intern submits a new project for review. */
    @Column(name = "prefs_trainer_notify_submissions")
    private Boolean prefsTrainerNotifySubmissions;

    /** Notify me when one of my escalations is reviewed by ERM. */
    @Column(name = "prefs_trainer_notify_escalation_resolved")
    private Boolean prefsTrainerNotifyEscalationResolved;

    /** When the user accepted ToS + privacy. Null for legacy pre-checkbox accounts. */
    @Column(name = "tos_accepted_at")
    private Instant tosAcceptedAt;

    /** Version of the ToS the user accepted (e.g. "2026-05-27"). */
    @Column(name = "tos_version", length = 32)
    private String tosVersion;

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
