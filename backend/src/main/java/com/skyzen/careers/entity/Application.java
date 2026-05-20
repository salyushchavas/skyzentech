package com.skyzen.careers.entity;

import com.skyzen.careers.enums.ApplicationStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "applications",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_application_candidate_job_posting",
                columnNames = {"candidate_id", "job_posting_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_posting_id", nullable = false)
    private JobPosting jobPosting;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resume_id")
    private Resume resume;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ApplicationStatus status = ApplicationStatus.APPLIED;

    @Column(nullable = false, updatable = false)
    private Instant appliedAt;

    @Column(nullable = false)
    private Instant statusUpdatedAt;

    @Column(name = "status_updated_by")
    private UUID statusUpdatedBy;

    @Column(name = "recruiter_notes", columnDefinition = "TEXT")
    private String recruiterNotes;

    /** Recruiter's 1-5 rating from the review screen. Nullable. */
    @Column(name = "recruiter_rating")
    private Integer recruiterRating;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.appliedAt = now;
        this.statusUpdatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.statusUpdatedAt = Instant.now();
    }
}
