package com.skyzen.careers.manager;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Manager Phase 1 — DTO shapes for the Executive Overview and the
 *  Applicant Pipeline list. Read-only; portfolio-wide for MANAGER and
 *  SUPER_ADMIN (per-manager scoping arrives in Phase 3 with the
 *  Active Interns / Timesheet surfaces). */
public final class ManagerDtos {

    private ManagerDtos() {}

    // ── Overview ──────────────────────────────────────────────────────────

    /** Headline payload for /careers/manager (Executive Overview). */
    public record OverviewResponse(
            CallerView caller,
            /** Count per InternLifecycleStatus, all 13 keys present
             *  (zero-filled). Canonical funnel source. */
            Map<String, Long> lifecycleCounts,
            /** Count per ApplicationStatus, only non-zero keys
             *  populated. Mirrors the early funnel. */
            Map<String, Long> applicationCounts,
            /** Coarse buckets the Home cards read directly. */
            HeadlineBuckets buckets,
            /** Conversion-rate KPIs. */
            ConversionKpis kpis,
            Instant generatedAt
    ) {}

    public record CallerView(
            UUID userId,
            String fullName,
            String email,
            String role,         // MANAGER | SUPER_ADMIN
            boolean superAdmin
    ) {}

    /** Pre-computed buckets the Home count cards bind to so the UI
     *  doesn't have to sum the raw status maps itself. */
    public record HeadlineBuckets(
            long totalApplications,           // applications.* count
            long applicantsInPipeline,        // APPLIED + SCREENING_* + SHORTLISTED + INTERVIEW_* + SELECTED_CONDITIONAL + OFFERED
            long offersAwaitingSignature,     // offers.status = SENT
            long prospectiveNewHires,         // users.lifecycle_status in OFFER_SIGNED..ONBOARDING_ACCEPTED
            long activeInterns,               // users.lifecycle_status = ACTIVE_INTERN
            long inactiveInterns              // users.lifecycle_status = INACTIVE_INTERN
    ) {}

    /** Conversion-rate KPIs, percentages 0-100, null when denominator is zero. */
    public record ConversionKpis(
            Double shortlistConversionPct,    // (interview-or-later) / (applied-or-later)
            Double interviewCompletionPct,    // INTERVIEWED+ / INTERVIEW_SCHEDULED+
            Double offerSignaturePct,         // OFFER_SIGNED-or-later / OFFER_SENT-or-later
            long offersPendingOver7Days       // pipeline-level overdue: SENT with sent_at < now-7d
    ) {}

    // ── Pipeline ──────────────────────────────────────────────────────────

    public record PipelineRow(
            UUID applicationId,
            String applicantName,
            String applicantId,
            String applicantEmail,
            String jobTitle,
            String jobType,
            String technology,               // null until JobPosting.technology lands
            String stage,                    // ApplicationStatus name
            String latestInterviewStatus,    // null if no interview rows yet
            Instant lastDecisionAt,
            long ageDays,
            UUID ermOwnerId,
            String ermOwnerName,
            LocalDate expectedStartDate      // latest offer.start_date if any
    ) {}

    public record PipelineResponse(
            List<PipelineRow> items,
            int page,
            int pageSize,
            long totalElements,
            int totalPages,
            FilterOptions filters
    ) {}

    /** Distinct values the UI feeds into its dropdowns so the user can't
     *  invent a value the backend wouldn't accept. */
    public record FilterOptions(
            List<String> stages,
            List<String> jobTypes,
            List<ErmOwnerOption> ermOwners
    ) {}

    public record ErmOwnerOption(
            UUID userId,
            String fullName
    ) {}
}
