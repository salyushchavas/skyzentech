package com.skyzen.careers.entity;

import com.skyzen.careers.enums.WeeklyMaterialStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * GAP_REPORT C1 — weekly training material published by a supervisor and
 * consumed by ACTIVE interns. Two publishing modes:
 *
 *   broadcast: {@code engagement} is null → visible to every ACTIVE intern.
 *   scoped:    {@code engagement} is non-null → visible to that one intern.
 *
 * Status lifecycle: DRAFT → RELEASED. RELEASED is terminal in v1. Once
 * released, a material accrues {@link MaterialAcknowledgement} rows from
 * interns who tick the "I've reviewed this" CTA on the dashboard.
 *
 * {@code resourceUrls} is a JSON-encoded array of strings (e.g. links to
 * external readings / videos / GitHub). Stored as TEXT to keep the column
 * portable; service layer (de)serializes with Jackson.
 */
@Entity
@Table(
        name = "weekly_materials",
        indexes = {
                @Index(name = "idx_weekly_material_status_release", columnList = "status, release_date"),
                @Index(name = "idx_weekly_material_engagement", columnList = "engagement_id"),
                @Index(name = "idx_weekly_material_week", columnList = "week_no")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeeklyMaterial {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "week_no", nullable = false)
    private Integer weekNo;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** JSON-encoded {@code List<String>} of external resource URLs. May be null/empty. */
    @Column(name = "resource_urls_json", columnDefinition = "TEXT")
    private String resourceUrlsJson;

    @Column(name = "due_date")
    private LocalDate dueDate;

    /**
     * When the supervisor releases the material. Stays null while DRAFT;
     * stamped at the {@code release()} call. Materials are sorted newest
     * release first on the intern dashboard.
     */
    @Column(name = "release_date")
    private Instant releaseDate;

    /** User who created (and will release) the material. NOT a soft ref. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "published_by", nullable = false)
    private User publishedBy;

    /**
     * Null for broadcasts (all ACTIVE interns see the material); set for
     * single-engagement scoped publishes. The release-time RBAC check
     * requires that the actor either owns this engagement
     * ({@code engagement.supervisor.id == actor.id}) or holds an elevated
     * role (ERM/ADMIN) — same shape as GAP B6.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "engagement_id")
    private Engagement engagement;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private WeeklyMaterialStatus status = WeeklyMaterialStatus.DRAFT;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }
}
