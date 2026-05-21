package com.skyzen.careers.entity;

import com.skyzen.careers.enums.TimesheetStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(
        name = "timesheets",
        indexes = {
                @Index(name = "idx_timesheet_intern", columnList = "intern_id"),
                @Index(name = "idx_timesheet_status", columnList = "status"),
                @Index(name = "idx_timesheet_week", columnList = "week_start")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Timesheet {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "intern_id", nullable = false)
    private Candidate intern;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal hours;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TimesheetStatus status = TimesheetStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }
}
