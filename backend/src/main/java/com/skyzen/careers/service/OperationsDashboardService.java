package com.skyzen.careers.service;

import com.skyzen.careers.dto.operations.ActionItemResponse;
import com.skyzen.careers.dto.operations.OnboardingQueueItemResponse;
import com.skyzen.careers.dto.operations.OpenPostingResponse;
import com.skyzen.careers.dto.operations.OperationsDashboardResponse;
import com.skyzen.careers.dto.operations.PipelineFunnelResponse;
import com.skyzen.careers.dto.operations.RecentApplicationResponse;
import com.skyzen.careers.dto.operations.UpcomingInterviewResponse;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Interview;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.enums.JobPostingStatus;
import com.skyzen.careers.enums.OnboardingTaskStatus;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.InterviewRepository;
import com.skyzen.careers.repository.JobPostingRepository;
import com.skyzen.careers.repository.OnboardingTaskRepository;
import com.skyzen.careers.repository.ScreeningRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Aggregate read for the Operations dashboard. Mirrors the single-round-trip
 * pattern from {@link CandidateDashboardService}: every dependency loads inside
 * one read-only transaction, the response is always a fully-formed object
 * (empty lists, zero counts — never {@code null}).
 *
 * <h2>Privilege boundary</h2>
 * This service deliberately does NOT depend on {@code I9FormRepository},
 * {@code I983PlanRepository}, {@code EVerifyCaseRepository},
 * {@code AdminUserService}, {@code AdminAuditLogService}, or
 * {@code AdminEntityService}. The response surfaces the broad
 * {@link EngagementStatus} phase label only — never compliance details.
 *
 * <h2>Funnel stages</h2>
 * Same five bands the candidate dashboard uses, counted across ALL
 * applications:
 * <pre>
 *   applied     = APPLIED
 *   screening   = SCREENING_SENT + SCREENING_COMPLETED + SHORTLISTED
 *   interview   = INTERVIEW_SCHEDULED + INTERVIEWED
 *   offer       = SELECTED_CONDITIONAL + OFFERED + ACCEPTED
 *   onboarding  = engagements in PENDING_COMPLIANCE or READY_TO_START
 * </pre>
 * Exit statuses (REJECTED / WITHDRAWN / LAPSED / NO_SHOW / engagement
 * COMPLETED / TERMINATED) are out of the funnel by design.
 */
@Service
@RequiredArgsConstructor
public class OperationsDashboardService {

    /** Most-recent applications shown on the dashboard. */
    private static final int RECENT_APPLICATIONS_LIMIT = 8;

    /** Upcoming interviews shown on the dashboard. */
    private static final int UPCOMING_INTERVIEWS_LIMIT = 6;

    /** Onboarding queue rows shown on the dashboard. */
    private static final int ONBOARDING_QUEUE_LIMIT = 6;

    /** Open postings shown on the dashboard. */
    private static final int OPEN_POSTINGS_LIMIT = 6;

    /** Stages whose counted apps belong to the "Screening" funnel band. */
    private static final Set<ApplicationStatus> SCREENING_BAND = EnumSet.of(
            ApplicationStatus.SCREENING_SENT,
            ApplicationStatus.SCREENING_COMPLETED,
            ApplicationStatus.SHORTLISTED);

    /** Stages whose counted apps belong to the "Interview" funnel band. */
    private static final Set<ApplicationStatus> INTERVIEW_BAND = EnumSet.of(
            ApplicationStatus.INTERVIEW_SCHEDULED,
            ApplicationStatus.INTERVIEWED);

    /** Stages whose counted apps belong to the "Offer" funnel band. */
    private static final Set<ApplicationStatus> OFFER_BAND = EnumSet.of(
            ApplicationStatus.SELECTED_CONDITIONAL,
            ApplicationStatus.OFFERED,
            ApplicationStatus.ACCEPTED);

    /** Engagement statuses representing the "Onboarding" funnel band. */
    private static final Set<EngagementStatus> ONBOARDING_BAND = EnumSet.of(
            EngagementStatus.PENDING_COMPLIANCE,
            EngagementStatus.READY_TO_START);

    private final ApplicationRepository applicationRepository;
    private final InterviewRepository interviewRepository;
    private final JobPostingRepository jobPostingRepository;
    private final OnboardingTaskRepository onboardingTaskRepository;
    private final EngagementRepository engagementRepository;
    private final ScreeningRepository screeningRepository;

    @Transactional(readOnly = true)
    public OperationsDashboardResponse build(User caller) {
        // The @PreAuthorize gate on the controller already rejects unauth
        // requests. This null guard yields a stable empty payload for any
        // internal call paths that don't go through Spring Security.
        String operatorName = (caller != null) ? caller.getFullName() : null;

        PipelineFunnelResponse pipeline = buildPipeline();
        List<ActionItemResponse> needsAttention = buildNeedsAttention(pipeline);
        List<UpcomingInterviewResponse> upcoming = buildUpcomingInterviews();
        long pendingScorecards = countPendingScorecards();
        List<OnboardingQueueItemResponse> onboardingQueue = buildOnboardingQueue();
        List<RecentApplicationResponse> recentApps = buildRecentApplications();
        List<OpenPostingResponse> openPostings = buildOpenPostings();

        return OperationsDashboardResponse.builder()
                .operatorName(operatorName)
                .pipeline(pipeline)
                .needsAttention(needsAttention)
                .upcomingInterviews(upcoming)
                .pendingScorecards(pendingScorecards)
                .onboardingQueue(onboardingQueue)
                .recentApplications(recentApps)
                .openPostings(openPostings)
                .build();
    }

    // ── Pipeline funnel ─────────────────────────────────────────────────────

    private PipelineFunnelResponse buildPipeline() {
        return PipelineFunnelResponse.builder()
                .applied(applicationRepository.countByStatus(ApplicationStatus.APPLIED))
                .screening(sumStatusCounts(SCREENING_BAND))
                .interview(sumStatusCounts(INTERVIEW_BAND))
                .offer(sumStatusCounts(OFFER_BAND))
                .onboarding(engagementRepository.countByStatusIn(ONBOARDING_BAND))
                .build();
    }

    private long sumStatusCounts(Set<ApplicationStatus> statuses) {
        long total = 0L;
        for (ApplicationStatus s : statuses) {
            total += applicationRepository.countByStatus(s);
        }
        return total;
    }

    // ── Needs your attention ────────────────────────────────────────────────

    private List<ActionItemResponse> buildNeedsAttention(PipelineFunnelResponse pipeline) {
        List<ActionItemResponse> items = new ArrayList<>(5);

        long newApps = pipeline.getApplied();
        items.add(ActionItemResponse.builder()
                .key("NEW_APPLICATIONS")
                .label("New applications to review")
                .count(newApps)
                .href("/careers/recruiter")
                .build());

        long screeningsToAssign = countScreeningsToAssign();
        items.add(ActionItemResponse.builder()
                .key("SCREENINGS_TO_ASSIGN")
                .label("Screenings to assign")
                .count(screeningsToAssign)
                .href("/careers/recruiter")
                .build());

        long interviewsToSchedule = countInterviewsToSchedule();
        items.add(ActionItemResponse.builder()
                .key("INTERVIEWS_TO_SCHEDULE")
                .label("Interviews to schedule")
                .count(interviewsToSchedule)
                .href("/careers/operations/interviews")
                .build());

        long pendingScorecards = countPendingScorecards();
        items.add(ActionItemResponse.builder()
                .key("SCORECARDS_TO_SUBMIT")
                .label("Scorecards to submit")
                .count(pendingScorecards)
                .href("/careers/operations/interviews")
                .build());

        long onboardingToAction = countOnboardingTasksPending();
        items.add(ActionItemResponse.builder()
                .key("ONBOARDING_TO_ACTION")
                .label("Onboarding tasks to action")
                .count(onboardingToAction)
                .href("/careers/supervised")
                .build());

        return items;
    }

    /**
     * Applications sitting in APPLIED status that have no Screening row yet.
     * We walk the (small, by definition) APPLIED set and check existence per
     * application — using the existing graph-fetch repository method. For
     * larger pipelines this would warrant a single COUNT query; until then
     * the simple form keeps the dependency surface minimal.
     */
    private long countScreeningsToAssign() {
        Page<Application> applied = applicationRepository.search(
                ApplicationStatus.APPLIED,
                null,
                PageRequest.of(0, 500, Sort.by(Sort.Direction.DESC, "appliedAt")));
        long count = 0L;
        for (Application a : applied.getContent()) {
            if (screeningRepository.findByApplicationIdWithGraph(a.getId()).isEmpty()) {
                count++;
            }
        }
        return count;
    }

    /**
     * Shortlisted applications without a SCHEDULED interview yet — Operations
     * needs to book one. Apps with a previously-CANCELLED or NO_SHOW interview
     * still count (the candidate isn't on the calendar).
     */
    private long countInterviewsToSchedule() {
        Page<Application> shortlisted = applicationRepository.search(
                ApplicationStatus.SHORTLISTED,
                null,
                PageRequest.of(0, 500, Sort.by(Sort.Direction.DESC, "statusUpdatedAt")));
        long count = 0L;
        for (Application a : shortlisted.getContent()) {
            if (!interviewRepository.existsByApplicationIdAndStatus(
                    a.getId(), InterviewStatus.SCHEDULED)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Interviews whose scheduled time has passed but feedback wasn't submitted.
     * Two cases caught:
     *   - status still SCHEDULED, scheduledAt in the past (interviewer didn't
     *     mark it COMPLETED at all)
     *   - status COMPLETED but feedbackSubmittedAt null
     */
    private long countPendingScorecards() {
        Instant now = Instant.now();
        Page<Interview> overdue = interviewRepository.findByScheduledAtBeforeOrderByScheduledAtDesc(
                now, PageRequest.of(0, 500));
        long count = 0L;
        for (Interview i : overdue.getContent()) {
            InterviewStatus s = i.getStatus();
            if (s == InterviewStatus.CANCELLED || s == InterviewStatus.NO_SHOW) {
                continue;
            }
            if (i.getFeedbackSubmittedAt() == null) {
                count++;
            }
        }
        return count;
    }

    /**
     * Pending OnboardingTask rows across all candidates currently in the
     * onboarding band. Cheap proxy for "stuff Ops chases candidates about."
     */
    private long countOnboardingTasksPending() {
        // Single roster query covers both bands; cheaper than two findByStatus
        // calls and re-uses the same fetch graph the queue uses.
        List<Engagement> engagements = engagementRepository.findRosterByStatusIn(
                ONBOARDING_BAND, null, null);
        long count = 0L;
        for (Engagement e : engagements) {
            if (e.getCandidate() == null || e.getCandidate().getId() == null) continue;
            count += onboardingTaskRepository.countByCandidateIdAndStatus(
                    e.getCandidate().getId(), OnboardingTaskStatus.PENDING);
        }
        return count;
    }

    // ── Upcoming interviews ─────────────────────────────────────────────────

    private List<UpcomingInterviewResponse> buildUpcomingInterviews() {
        Instant now = Instant.now();
        Page<Interview> page = interviewRepository.findByScheduledAtAfterOrderByScheduledAtAsc(
                now, PageRequest.of(0, UPCOMING_INTERVIEWS_LIMIT));

        List<UpcomingInterviewResponse> out = new ArrayList<>(page.getContent().size());
        for (Interview i : page.getContent()) {
            if (i.getStatus() != InterviewStatus.SCHEDULED) continue;
            String candidateName = null;
            String position = null;
            if (i.getApplication() != null) {
                if (i.getApplication().getCandidate() != null
                        && i.getApplication().getCandidate().getUser() != null) {
                    candidateName = i.getApplication().getCandidate().getUser().getFullName();
                }
                if (i.getApplication().getJobPosting() != null) {
                    position = i.getApplication().getJobPosting().getTitle();
                }
            }
            String interviewerName = (i.getInterviewer() != null)
                    ? i.getInterviewer().getFullName() : null;
            out.add(UpcomingInterviewResponse.builder()
                    .id(i.getId())
                    .applicationId(i.getApplication() != null ? i.getApplication().getId() : null)
                    .candidateName(candidateName)
                    .position(position)
                    .scheduledAt(i.getScheduledAt())
                    .type(i.getType() != null ? i.getType().name() : null)
                    .interviewerName(interviewerName)
                    .build());
        }
        return out;
    }

    // ── Onboarding queue ────────────────────────────────────────────────────

    private List<OnboardingQueueItemResponse> buildOnboardingQueue() {
        // Pulls a small N for the dashboard — the supervised page is where
        // Operations works the full list.
        List<Engagement> engagements = engagementRepository.findRosterByStatusIn(
                ONBOARDING_BAND, null, null);
        List<OnboardingQueueItemResponse> out = new ArrayList<>();
        int seen = 0;
        for (Engagement e : engagements) {
            if (seen >= ONBOARDING_QUEUE_LIMIT) break;
            if (e.getCandidate() == null || e.getCandidate().getId() == null) continue;
            UUID candidateId = e.getCandidate().getId();

            String candidateName = (e.getCandidate().getUser() != null)
                    ? e.getCandidate().getUser().getFullName() : null;
            String position = null;
            if (e.getApplication() != null && e.getApplication().getJobPosting() != null) {
                position = e.getApplication().getJobPosting().getTitle();
            }
            int pendingTasks = (int) onboardingTaskRepository
                    .countByCandidateIdAndStatus(candidateId, OnboardingTaskStatus.PENDING);

            out.add(OnboardingQueueItemResponse.builder()
                    .engagementId(e.getId())
                    .candidateId(candidateId)
                    .candidateName(candidateName)
                    .position(position)
                    .status(e.getStatus() != null ? e.getStatus().name() : null)
                    .pendingTaskCount(pendingTasks)
                    .build());
            seen++;
        }
        return out;
    }

    // ── Recent applications ─────────────────────────────────────────────────

    private List<RecentApplicationResponse> buildRecentApplications() {
        Page<Application> page = applicationRepository.search(
                null, null,
                PageRequest.of(0, RECENT_APPLICATIONS_LIMIT,
                        Sort.by(Sort.Direction.DESC, "appliedAt")));

        List<RecentApplicationResponse> out = new ArrayList<>(page.getContent().size());
        for (Application a : page.getContent()) {
            String candidateName = (a.getCandidate() != null && a.getCandidate().getUser() != null)
                    ? a.getCandidate().getUser().getFullName() : null;
            String position = (a.getJobPosting() != null) ? a.getJobPosting().getTitle() : null;
            String entityName = (a.getJobPosting() != null && a.getJobPosting().getEntity() != null)
                    ? a.getJobPosting().getEntity().getName() : null;
            out.add(RecentApplicationResponse.builder()
                    .id(a.getId())
                    .candidateName(candidateName)
                    .position(position)
                    .entityName(entityName)
                    .status(a.getStatus())
                    .appliedAt(a.getAppliedAt())
                    .build());
        }
        return out;
    }

    // ── Open postings + per-posting application counts ──────────────────────

    private List<OpenPostingResponse> buildOpenPostings() {
        Page<JobPosting> page = jobPostingRepository.findByStatus(
                JobPostingStatus.OPEN,
                PageRequest.of(0, OPEN_POSTINGS_LIMIT,
                        Sort.by(Sort.Direction.DESC, "publishedAt")));
        List<JobPosting> postings = page.getContent();
        if (postings.isEmpty()) return Collections.emptyList();

        // Batch the per-posting count in one query rather than N+1.
        List<UUID> ids = new ArrayList<>(postings.size());
        for (JobPosting p : postings) ids.add(p.getId());
        Map<UUID, Long> countByPosting = new HashMap<>();
        for (Object[] row : applicationRepository.countByJobPostingIdIn(ids)) {
            countByPosting.put((UUID) row[0], ((Number) row[1]).longValue());
        }

        List<OpenPostingResponse> out = new ArrayList<>(postings.size());
        for (JobPosting p : postings) {
            String entityName = (p.getEntity() != null) ? p.getEntity().getName() : null;
            out.add(OpenPostingResponse.builder()
                    .id(p.getId())
                    .title(p.getTitle())
                    .entityName(entityName)
                    .applicationCount(countByPosting.getOrDefault(p.getId(), 0L))
                    .build());
        }
        return out;
    }
}
