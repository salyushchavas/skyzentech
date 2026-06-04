package com.skyzen.careers.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Phase 5 weekly trainer-intern support meeting. ZoomService creates the
 * actual meeting (single or recurring); this row persists the metadata +
 * applicant-safe URL. {@code zoomStartUrl} + {@code trainerNotes} are
 * HOST-ONLY and must never be serialised to an INTERN actor.
 */
@Entity
@Table(name = "weekly_meetings", indexes = {
        @Index(name = "idx_weekly_meetings_lifecycle_scheduled",
                columnList = "intern_lifecycle_id, scheduled_for"),
        @Index(name = "idx_weekly_meetings_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeeklyMeeting {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "intern_lifecycle_id", nullable = false)
    private UUID internLifecycleId;

    @Column(name = "scheduled_for", nullable = false)
    private Instant scheduledFor;

    @Column(name = "duration_minutes", nullable = false)
    @Builder.Default
    private Integer durationMinutes = 30;

    @Column(name = "timezone", nullable = false, length = 50,
            columnDefinition = "varchar(50) not null default 'UTC'")
    @Builder.Default
    private String timezone = "UTC";

    @Column(name = "topic", nullable = false, length = 200)
    private String topic;

    @Column(name = "agenda", columnDefinition = "TEXT")
    private String agenda;

    @Column(name = "zoom_meeting_id")
    private Long zoomMeetingId;

    @Column(name = "zoom_join_url", columnDefinition = "TEXT")
    private String zoomJoinUrl;

    /** HOST-ONLY — never returned to interns. */
    @Column(name = "zoom_start_url", columnDefinition = "TEXT")
    private String zoomStartUrl;

    @Column(name = "zoom_password", length = 40)
    private String zoomPassword;

    @Column(name = "host_user_id", nullable = false)
    private UUID hostUserId;

    /** SCHEDULED | COMPLETED | CANCELLED | NO_SHOW. */
    @Column(name = "status", nullable = false, length = 20,
            columnDefinition = "varchar(20) not null default 'SCHEDULED'")
    @Builder.Default
    private String status = "SCHEDULED";

    /** WEEKLY for series; null for one-off. */
    @Column(name = "recurrence", length = 20)
    private String recurrence;

    @Column(name = "recurrence_parent_id")
    private UUID recurrenceParentId;

    /** Trainer-only notes — never returned to interns. */
    @Column(name = "trainer_notes", columnDefinition = "TEXT")
    private String trainerNotes;

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
