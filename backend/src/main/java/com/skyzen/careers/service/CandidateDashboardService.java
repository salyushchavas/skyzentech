package com.skyzen.careers.service;

import com.skyzen.careers.application.ApplicationLifecycle;
import com.skyzen.careers.dto.candidate.CandidateDashboardResponse;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Interview;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.OnboardingTask;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.enums.OnboardingTaskStatus;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.InterviewRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.OnboardingTaskRepository;
import com.skyzen.careers.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Builds the aggregate payload for the candidate dashboard. All reads run in
 * a single read-only transaction; every dependency query is fetch-joined so
 * the DTO mappers never touch a lazy proxy. Empty-state is a fully-formed
 * response — never a 404, never a null list.
 *
 * Stage map (0..4, capped at 4):
 *   APPLIED                 -> 0
 *   SHORTLISTED             -> 1
 *   INTERVIEW_SCHEDULED|INTERVIEWED -> 2
 *   OFFERED|ACCEPTED        -> 3   (spec names "OFFER_EXTENDED"/"OFFER_ACCEPTED")
 *   ONBOARDING|ACTIVE|HIRED|COMPLETED -> 4
 * Exit statuses (REJECTED|WITHDRAWN|LAPSED|NO_SHOW) flip isExited=true and
 * stageIndex=-1 — the entity doesn't store the pre-exit stage, so we don't
 * fake one. The frontend renders exited rows with a separate visual treatment.
 */
@Service
@RequiredArgsConstructor
public class CandidateDashboardService {

    private static final int RECENT_ACTIVITY_LIMIT = 5;

    private final CandidateRepository candidateRepository;
    private final ApplicationRepository applicationRepository;
    private final OfferRepository offerRepository;
    private final InterviewRepository interviewRepository;
    private final OnboardingTaskRepository onboardingTaskRepository;
    private final ResumeRepository resumeRepository;
    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public CandidateDashboardResponse build(User caller) {
        // Defensive: an unauthenticated principal yields a fully-empty shape
        // rather than a 500. @PreAuthorize on the controller already blocks
        // this path; the guard is belt-and-braces.
        if (caller == null || caller.getId() == null) {
            return empty(null);
        }

        UUID userId = caller.getId();
        String candidateName = caller.getFullName();

        // A user with the CANDIDATE role might not yet have a Candidate row
        // (registration lazy-creates on first apply / resume upload). Treat
        // that as "brand-new candidate" and return the empty shape with the
        // "Complete your profile" / "Browse openings" next step.
        Candidate candidate = candidateRepository.findByUserId(userId).orElse(null);
        if (candidate == null) {
            return empty(caller);
        }

        // ── Profile completeness ─────────────────────────────────────────────
        boolean hasName = caller.getFullName() != null && !caller.getFullName().isBlank();
        boolean hasPhone = caller.getPhoneNumber() != null && !caller.getPhoneNumber().isBlank();
        boolean hasDob = candidate.getDateOfBirth() != null;
        boolean hasResume = candidate.getDefaultResumeId() != null
                || !resumeRepository.findByCandidateId(candidate.getId()).isEmpty();
        int profileComplete = percentFilled(hasName, hasPhone, hasDob, hasResume);

        // ── Applications + stage mapping ─────────────────────────────────────
        List<Application> apps = applicationRepository
                .findByCandidateIdWithPosting(candidate.getId());
        List<CandidateDashboardResponse.ApplicationSummary> appSummaries = apps.stream()
                .map(this::toApplicationSummary)
                .toList();

        // ── Offers + upcoming interviews + onboarding (single-fetch each) ────
        List<Offer> offers = offerRepository
                .findByCandidateUserIdWithGraph(userId);
        Instant now = Instant.now();
        List<Interview> upcomingInterviews = interviewRepository
                .findAllForCandidateUser(userId).stream()
                .filter(i -> i.getStatus() == InterviewStatus.SCHEDULED
                        && i.getScheduledAt() != null
                        && !i.getScheduledAt().isBefore(now))
                .sorted(Comparator.comparing(Interview::getScheduledAt))
                .toList();
        List<OnboardingTask> tasks = onboardingTaskRepository
                .findByCandidateIdOrderBySortOrderAsc(candidate.getId());

        // ── nextStep priority ladder ─────────────────────────────────────────
        CandidateDashboardResponse.NextStep nextStep = pickNextStep(
                apps, offers, upcomingInterviews, tasks, profileComplete);

        // ── Upcoming items ────────────────────────────────────────────────────
        List<CandidateDashboardResponse.UpcomingItem> upcoming = assembleUpcoming(
                offers, upcomingInterviews, tasks);

        // ── Recent activity from AuditLog ────────────────────────────────────
        List<CandidateDashboardResponse.ActivityItem> recentActivity =
                assembleRecentActivity(apps, offers);

        return CandidateDashboardResponse.builder()
                .candidateName(candidateName)
                .profileComplete(profileComplete)
                .nextStep(nextStep)
                .applications(appSummaries)
                .upcoming(upcoming)
                .recentActivity(recentActivity)
                .build();
    }

    // ── Mapping helpers ─────────────────────────────────────────────────────

    private CandidateDashboardResponse.ApplicationSummary toApplicationSummary(Application a) {
        JobPosting jp = a.getJobPosting();
        StaffingEntity ent = jp != null ? jp.getEntity() : null;
        boolean exited = ApplicationLifecycle.isExited(a.getStatus());
        int stage = exited ? -1 : ApplicationLifecycle.stageIndexOf(a.getStatus());
        return CandidateDashboardResponse.ApplicationSummary.builder()
                .id(a.getId())
                .position(jp != null ? jp.getTitle() : null)
                .entityName(ent != null ? ent.getName() : null)
                .status(a.getStatus() != null ? a.getStatus().name() : null)
                .stageIndex(stage)
                .isExited(exited)
                .build();
    }

    private int percentFilled(boolean... flags) {
        if (flags.length == 0) return 0;
        int filled = 0;
        for (boolean b : flags) if (b) filled++;
        return (filled * 100) / flags.length;
    }

    // ── nextStep ─────────────────────────────────────────────────────────────

    private CandidateDashboardResponse.NextStep pickNextStep(
            List<Application> apps,
            List<Offer> offers,
            List<Interview> upcomingInterviews,
            List<OnboardingTask> tasks,
            int profileComplete) {

        List<Application> activeApps = apps.stream()
                .filter(a -> !ApplicationLifecycle.isExited(a.getStatus()))
                .toList();

        // 1. Live SENT offer — the most time-sensitive thing on the dashboard.
        Offer sent = offers.stream()
                .filter(o -> o.getStatus() == OfferStatus.SENT)
                .findFirst()
                .orElse(null);
        if (sent != null) {
            String position = sent.getApplication() != null
                    && sent.getApplication().getJobPosting() != null
                    ? sent.getApplication().getJobPosting().getTitle()
                    : null;
            String subtitle = sent.getExpiresAt() != null
                    ? "Respond by " + sent.getExpiresAt().toString()
                    : "Review your offer";
            return CandidateDashboardResponse.NextStep.builder()
                    .type("OFFER")
                    .title(position != null
                            ? "You have an offer — " + position
                            : "You have an offer")
                    .subtitle(subtitle)
                    .ctaLabel("View offer")
                    .ctaHref("/careers/candidate/offers/" + sent.getId())
                    .build();
        }

        // 2. Upcoming interview.
        Interview nextInterview = upcomingInterviews.stream().findFirst().orElse(null);
        if (nextInterview != null) {
            String position = nextInterview.getApplication() != null
                    && nextInterview.getApplication().getJobPosting() != null
                    ? nextInterview.getApplication().getJobPosting().getTitle()
                    : null;
            return CandidateDashboardResponse.NextStep.builder()
                    .type("INTERVIEW")
                    .title(position != null
                            ? "Interview scheduled — " + position
                            : "Interview scheduled")
                    .subtitle(nextInterview.getScheduledAt() != null
                            ? nextInterview.getScheduledAt().toString()
                            : null)
                    .ctaLabel("View details")
                    .ctaHref("/careers/candidate/interviews")
                    .build();
        }

        // 3. Onboarding incomplete after acceptance/hire.
        boolean hasAcceptedOrHired = activeApps.stream()
                .anyMatch(a -> a.getStatus() == ApplicationStatus.ACCEPTED
                        || a.getStatus() == ApplicationStatus.HIRED
                        || a.getStatus() == ApplicationStatus.ONBOARDING);
        long totalTasks = tasks.size();
        long doneTasks = tasks.stream()
                .filter(t -> t.getStatus() == OnboardingTaskStatus.COMPLETED)
                .count();
        if (hasAcceptedOrHired && totalTasks > 0 && doneTasks < totalTasks) {
            return CandidateDashboardResponse.NextStep.builder()
                    .type("ONBOARDING")
                    .title("Complete onboarding (" + doneTasks + " of " + totalTasks + ")")
                    .subtitle(null)
                    .ctaLabel("Continue onboarding")
                    .ctaHref("/careers/candidate/onboarding")
                    .build();
        }

        // 4. HIRED + active intern — weekly work submission.
        boolean isActiveIntern = activeApps.stream()
                .anyMatch(a -> a.getStatus() == ApplicationStatus.HIRED
                        || a.getStatus() == ApplicationStatus.ACTIVE);
        if (isActiveIntern) {
            return CandidateDashboardResponse.NextStep.builder()
                    .type("WORK")
                    .title("Submit this week's work")
                    .subtitle("Log hours and submit assignments")
                    .ctaLabel("Open My Work")
                    .ctaHref("/careers/intern/work")
                    .build();
        }

        // 5. Furthest non-exited application below the offer/interview tier.
        Application furthest = activeApps.stream()
                .max(Comparator.comparingInt(a -> ApplicationLifecycle.stageIndexOf(a.getStatus())))
                .orElse(null);
        if (furthest != null) {
            String position = furthest.getJobPosting() != null
                    ? furthest.getJobPosting().getTitle()
                    : null;
            ApplicationStatus status = furthest.getStatus();
            if (status == ApplicationStatus.SHORTLISTED) {
                return CandidateDashboardResponse.NextStep.builder()
                        .type("SHORTLISTED")
                        .title(position != null
                                ? "You've been shortlisted — " + position
                                : "You've been shortlisted")
                        .subtitle("A recruiter will reach out with next steps")
                        .ctaLabel("View application")
                        .ctaHref("/careers/candidate/applications")
                        .build();
            }
            if (status == ApplicationStatus.APPLIED) {
                return CandidateDashboardResponse.NextStep.builder()
                        .type("APPLIED")
                        .title("Your application is under review")
                        .subtitle(position)
                        .ctaLabel(null)
                        .ctaHref(null)
                        .build();
            }
        }

        // 6. No applications at all — push profile or browse.
        if (apps.isEmpty()) {
            if (profileComplete < 100) {
                return CandidateDashboardResponse.NextStep.builder()
                        .type("PROFILE")
                        .title("Complete your profile")
                        .subtitle(profileComplete + "% complete")
                        .ctaLabel("Edit profile")
                        .ctaHref("/careers/candidate/profile")
                        .build();
            }
            return CandidateDashboardResponse.NextStep.builder()
                    .type("BROWSE")
                    .title("Browse open internships")
                    .subtitle("Find a role that matches your skills")
                    .ctaLabel("View openings")
                    .ctaHref("/careers/openings")
                    .build();
        }

        // Fallback — all apps exited.
        return null;
    }

    // ── Upcoming items ──────────────────────────────────────────────────────

    private List<CandidateDashboardResponse.UpcomingItem> assembleUpcoming(
            List<Offer> offers,
            List<Interview> upcomingInterviews,
            List<OnboardingTask> tasks) {

        List<CandidateDashboardResponse.UpcomingItem> out = new ArrayList<>();

        for (Interview i : upcomingInterviews) {
            JobPosting jp = i.getApplication() != null ? i.getApplication().getJobPosting() : null;
            out.add(CandidateDashboardResponse.UpcomingItem.builder()
                    .type("INTERVIEW")
                    .title("Interview" + (jp != null ? " — " + jp.getTitle() : ""))
                    .subtitle(i.getInterviewer() != null
                            ? "With " + i.getInterviewer().getFullName()
                            : null)
                    .at(i.getScheduledAt())
                    .build());
        }

        for (Offer o : offers) {
            if (o.getStatus() == OfferStatus.SENT && o.getExpiresAt() != null) {
                JobPosting jp = o.getApplication() != null ? o.getApplication().getJobPosting() : null;
                out.add(CandidateDashboardResponse.UpcomingItem.builder()
                        .type("OFFER_EXPIRY")
                        .title("Offer expires" + (jp != null ? " — " + jp.getTitle() : ""))
                        .subtitle("Respond before the deadline")
                        .at(o.getExpiresAt())
                        .build());
            }
        }

        for (OnboardingTask t : tasks) {
            boolean incomplete = t.getStatus() != OnboardingTaskStatus.COMPLETED
                    && t.getStatus() != OnboardingTaskStatus.NOT_APPLICABLE;
            if (incomplete && t.getDueDate() != null) {
                Instant at = t.getDueDate()
                        .atStartOfDay(java.time.ZoneOffset.UTC)
                        .toInstant();
                out.add(CandidateDashboardResponse.UpcomingItem.builder()
                        .type("ONBOARDING_DUE")
                        .title(t.getTitle())
                        .subtitle("Onboarding task")
                        .at(at)
                        .build());
            }
        }

        out.sort(Comparator.comparing(
                CandidateDashboardResponse.UpcomingItem::getAt,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return out;
    }

    // ── Recent activity ─────────────────────────────────────────────────────

    private List<CandidateDashboardResponse.ActivityItem> assembleRecentActivity(
            List<Application> apps, List<Offer> offers) {

        Set<UUID> appIds = apps.stream().map(Application::getId).collect(Collectors.toCollection(HashSet::new));
        Set<UUID> offerIds = offers.stream().map(Offer::getId).collect(Collectors.toCollection(HashSet::new));

        List<AuditLog> rows = new ArrayList<>();
        rows.addAll(safeFetch("Application", appIds));
        rows.addAll(safeFetch("Offer", offerIds));

        rows.sort(Comparator.comparing(AuditLog::getTimestamp,
                Comparator.nullsLast(Comparator.reverseOrder())));

        return rows.stream()
                .limit(RECENT_ACTIVITY_LIMIT)
                .map(this::toActivityItem)
                .collect(Collectors.toList());
    }

    private List<AuditLog> safeFetch(String entityType, Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) return Collections.emptyList();
        return auditLogRepository.findRecentForEntityIds(
                entityType, ids, PageRequest.of(0, RECENT_ACTIVITY_LIMIT));
    }

    private CandidateDashboardResponse.ActivityItem toActivityItem(AuditLog a) {
        String text = switch (a.getAction()) {
            case "STATUS_CHANGE" -> a.getEntityType() + " status updated";
            case "SHORTLIST" -> "Application shortlisted";
            case "REJECT" -> "Application rejected";
            case "CREATE" -> "Offer extended";
            case "SEND" -> "Offer sent";
            case "ACCEPT" -> "Offer accepted";
            case "DECLINE" -> "Offer declined";
            case "REVOKE" -> "Offer revoked";
            case "EXPIRE" -> "Offer expired";
            default -> a.getEntityType() + " " + a.getAction().toLowerCase();
        };
        return CandidateDashboardResponse.ActivityItem.builder()
                .text(text)
                .at(a.getTimestamp())
                .build();
    }

    // ── Empty-state ─────────────────────────────────────────────────────────

    private CandidateDashboardResponse empty(User caller) {
        // No Candidate row yet — either brand-new account or registration lazy-
        // create hasn't fired. Build profileComplete from just the User fields
        // we do have so the % isn't always 0.
        int profileComplete = 0;
        String name = null;
        if (caller != null) {
            name = caller.getFullName();
            boolean hasName = name != null && !name.isBlank();
            boolean hasPhone = caller.getPhoneNumber() != null && !caller.getPhoneNumber().isBlank();
            profileComplete = percentFilled(hasName, hasPhone, false, false);
        }

        CandidateDashboardResponse.NextStep next = profileComplete < 100
                ? CandidateDashboardResponse.NextStep.builder()
                        .type("PROFILE")
                        .title("Complete your profile")
                        .subtitle(profileComplete + "% complete")
                        .ctaLabel("Edit profile")
                        .ctaHref("/careers/candidate/profile")
                        .build()
                : CandidateDashboardResponse.NextStep.builder()
                        .type("BROWSE")
                        .title("Browse open internships")
                        .subtitle("Find a role that matches your skills")
                        .ctaLabel("View openings")
                        .ctaHref("/careers/openings")
                        .build();

        return CandidateDashboardResponse.builder()
                .candidateName(name)
                .profileComplete(profileComplete)
                .nextStep(next)
                .applications(Collections.emptyList())
                .upcoming(Collections.emptyList())
                .recentActivity(Collections.emptyList())
                .build();
    }
}
