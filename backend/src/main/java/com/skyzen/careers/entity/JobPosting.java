package com.skyzen.careers.entity;

import com.skyzen.careers.enums.EmploymentType;
import com.skyzen.careers.enums.JobPostingStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "job_postings",
        indexes = {
                @Index(name = "idx_job_postings_slug", columnList = "slug", unique = true),
                @Index(name = "idx_job_postings_status", columnList = "status")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobPosting {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entity_id", nullable = false)
    private StaffingEntity entity;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String requirements;

    private String location;

    /**
     * Renamed per the Applicant-to-Intern Lifecycle doc (Phase 0): the column
     * was {@code employment_type}; an idempotent ALTER ... RENAME COLUMN in
     * {@link com.skyzen.careers.bootstrap.SchemaFixupRunner} migrates existing
     * deployments. Java field name kept as {@code employmentType} so the
     * blast radius across DTOs/services stays small.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "job_type", nullable = false)
    @Builder.Default
    private EmploymentType employmentType = EmploymentType.INTERNSHIP;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private JobPostingStatus status = JobPostingStatus.DRAFT;

    @Column(name = "published_by_id")
    private UUID publishedById;

    private Instant publishedAt;

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
