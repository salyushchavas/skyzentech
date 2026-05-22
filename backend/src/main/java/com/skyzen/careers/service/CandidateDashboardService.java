package com.skyzen.careers.service;

import com.skyzen.careers.application.ApplicationLifecycle;
import com.skyzen.careers.dto.candidate.CandidateDashboardResponse;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.EVerifyCase;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.I983Plan;
import com.skyzen.careers.entity.I9Form;
import com.skyzen.careers.entity.Interview;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.OnboardingTask;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.EVerifyStatus;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.I983Status;
import com.skyzen.careers.enums.I9Status;
import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.enums.OnboardingTaskStatus;
import com.skyzen.careers.enums.WorkAuthTrack;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.EVerifyCaseRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.I9FormRepository;
import com.skyzen.careers.repository.I983PlanRepository;
import com.skyzen.careers.repository.InterviewRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.OnboardingTaskRepository;
import com.skyzen.careers.repository.ResumeRepository;
import com.skyzen.careers.repository.ScreeningRepository;
import com.skyzen.careers.repository.UserRepository;
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
    private final ScreeningRepository screeningRepository;
    private final EngagementRepository engagementRepository;
    private final I9FormRepository i9FormRepository;
    private final I983PlanRepository i983PlanRepository;
    private final EVerifyCaseRepository everifyCaseRepository;
    private final UserRepository userRepository;

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
        // Phase 1.4 — factors expanded to include intake fields + the neutral
        // self-attestation. dateOfBirth + resume are kept so the existing 0-100
        // semantics don't regress for candidates who already filled them in.
        boolean hasName = caller.getFullName() != null && !caller.getFullName().isBlank();
        boolean hasPhone = caller.getPhoneNumber() != null && !caller.getPhoneNumber().isBlank();
        boolean hasDob = candidate.getDateOfBirth() != null;
        boolean hasResume = candidate.getDefaultResumeId() != null
                || !resumeRepository.findByCandidateId(candidate.getId()).isEmpty();
        boolean hasSkillset = candidate.getSkillset() != null && !candidate.getSkillset().isBlank();
        // Either the freeform education line OR the school/degree pair counts —
        // candidates entering one or the other shouldn't be penalised.
        boolean hasEducation =
                (candidate.getEducation() != null && !candidate.getEducation().isBlank())
                || (candidate.getSchool() != null && !candidate.getSchool().isBlank())
                || (candidate.getDegree() != null && !candidate.getDegree().isBlank());
        // "Attestation answered" = the candidate has expressed a position on
        // the primary authorised-to-work prompt. sponsorshipNeeded/expectedTrack/
        // validityDate are not required to count as answered.
        boolean hasAttestation = candidate.getAuthorizedToWork() != null;
        int profileComplete = percentFilled(
                hasName, hasPhone, hasDob, hasResume,
                hasSkillset, hasEducation, hasAttestation);

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

        // Phase 3 step 10 — the candidate's active engagement, if any. Source
        // of truth for post-offer state on the dashboard; pickNextStep falls
        // back to Application post-offer statuses when engagement is null.
        // For nextStep we ignore BLOCKED/TERMINATED. For the stepper override
        // we want to know about a BLOCKED engagement so the final dot can be
        // rendered with a blocked indicator — collected separately below.
        Engagement engagement = engagementRepository.findByCandidateId(candidate.getId()).stream()
                .filter(e -> e.getStatus() != EngagementStatus.BLOCKED_NO_AUTHORIZATION
                        && e.getStatus() != EngagementStatus.TERMINATED)
                .findFirst()
                .orElse(null);
        Engagement stepperEngagement = engagement != null
                ? engagement
                : engagementRepository.findByCandidateId(candidate.getId()).stream()
                        .filter(e -> e.getStatus() != EngagementStatus.TERMINATED)
                        .findFirst()
                        .orElse(null);

        // ── nextStep priority ladder ─────────────────────────────────────────
        CandidateDashboardResponse.NextStep nextStep = pickNextStep(
                apps, offers, upcomingInterviews, tasks, profileComplete, engagement);

        // ── Upcoming items ────────────────────────────────────────────────────
        List<CandidateDashboardResponse.UpcomingItem> upcoming = assembleUpcoming(
                offers, upcomingInterviews, tasks);

        // ── Recent activity from AuditLog ────────────────────────────────────
        List<CandidateDashboardResponse.ActivityItem> recentActivity =
                assembleRecentActivity(apps, offers);

        CandidateDashboardResponse.EngagementSummary engagementSummary =
                buildEngagementSummary(stepperEngagement, tasks);

        List<CandidateDashboardResponse.ComplianceItem> compliance =
                buildComplianceItems(candidate.getId(), stepperEngagement, offers);

        return CandidateDashboardResponse.builder()
                .candidateName(candidateName)
                .profileComplete(profileComplete)
                .nextStep(nextStep)
                .applications(appSummaries)
                .upcoming(upcoming)
                .recentActivity(recentActivity)
                .engagement(engagementSummary)
                .compliance(compliance)
                .build();
    }

    /**
     * Maps Engagement.status to the frontend final-stage label/state pair so
     * the stepper agrees with the banner. Returns null when there's no
     * engagement (pre-offer / legacy). Onboarding counts are derived from the
     * already-loaded tasks list to avoid an extra round-trip.
     */
    private CandidateDashboardResponse.EngagementSummary buildEngagementSummary(
            Engagement engagement, List<OnboardingTask> tasks) {
        if (engagement == null) return null;
        EngagementStatus status = engagement.getStatus();
        String label;
        String state;
        switch (status) {
            case PENDING_COMPLIANCE, READY_TO_START -> { label = "Onboarding"; state = "current"; }
            case ACTIVE -> { label = "Active"; state = "current"; }
            case COMPLETED -> { label = "Completed"; state = "completed"; }
            case BLOCKED_NO_AUTHORIZATION -> { label = "Blocked"; state = "blocked"; }
            case TERMINATED -> { label = "Ended"; state = "blocked"; }
            default -> { label = "Hired"; state = "current"; }
        }
        long total = tasks.size();
        long done = tasks.stream()
                .filter(t -> t.getStatus() == OnboardingTaskStatus.COMPLETED)
                .count();
        UUID applicationId = engagement.getApplication() != null
                ? engagement.getApplication().getId()
                : null;
        return CandidateDashboardResponse.EngagementSummary.builder()
                .applicationId(applicationId)
                .status(status != null ? status.name() : null)
                .finalStageLabel(label)
                .finalStageState(state)
                .onboardingTotal(total)
                .onboardingCompleted(done)
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

    // ── Compliance status panel ──────────────────────────────────────────────

    /**
     * Build the candidate-visible compliance status list. Returns an empty
     * list pre-offer (no engagement and no I-9 row) so the frontend hides the
     * panel entirely. Each item names who acted, when, and what's pending —
     * the candidate should never have to ask "did HR finish my I-9 yet?".
     *
     * Items returned (depending on engagement track + state):
     *   I9_SECTION_1 — always when an I-9 row exists
     *   I9_SECTION_2 — always when an I-9 row exists
     *   EVERIFY      — STEM_OPT, or any track when an E-Verify case exists
     *   I983         — STEM_OPT only
     */
    private List<CandidateDashboardResponse.ComplianceItem> buildComplianceItems(
            UUID candidateId, Engagement engagement, List<Offer> offers) {
        List<CandidateDashboardResponse.ComplianceItem> items = new ArrayList<>();
        if (candidateId == null) return items;

        I9Form i9 = i9FormRepository.findByCandidateId(candidateId).orElse(null);
        boolean hasAcceptedOffer = offers.stream()
                .anyMatch(o -> o.getStatus() == OfferStatus.ACCEPTED);
        // Hide the panel entirely until there's actually compliance work to
        // surface (no accepted offer AND no I-9 row → pre-offer noise).
        if (i9 == null && !hasAcceptedOffer && engagement == null) {
            return items;
        }

        // ── I-9 Section 1 (candidate) ────────────────────────────────────────
        if (i9 != null) {
            String s1State;
            String s1Sub;
            Instant s1At = i9.getSection1SignedAt();
            if (s1At != null) {
                s1State = "COMPLETED";
                String who = i9.getSection1SignedByName() != null
                        ? i9.getSection1SignedByName()
                        : "you";
                s1Sub = "Signed by " + who + " on " + formatDate(s1At);
            } else if (i9.getStatus() == I9Status.NOT_STARTED) {
                s1State = "NOT_STARTED";
                s1Sub = "Not started yet";
            } else {
                s1State = "IN_PROGRESS";
                s1Sub = "Draft saved — finish signing to submit";
            }
            items.add(CandidateDashboardResponse.ComplianceItem.builder()
                    .kind("I9_SECTION_1")
                    .label("Form I-9 — Section 1")
                    .state(s1State)
                    .subtitle(s1Sub)
                    .href("/careers/candidate/i9")
                    .completedAt(s1At)
                    .build());

            // ── I-9 Section 2 (HR) ───────────────────────────────────────────
            String s2State;
            String s2Sub;
            Instant s2At = i9.getSection2SignedAt();
            if (i9.getStatus() == I9Status.COMPLETED && s2At != null) {
                s2State = "COMPLETED";
                String hrName = lookupUserName(i9.getSection2SignedByUserId());
                s2Sub = hrName != null
                        ? "Verified by " + hrName + " on " + formatDate(s2At)
                        : "Verified by HR on " + formatDate(s2At);
            } else if (i9.getStatus() == I9Status.SECTION_2_PENDING
                    || i9.getStatus() == I9Status.SECTION_1_COMPLETE) {
                s2State = "AWAITING_HR";
                s2Sub = "Awaiting HR verification";
            } else if (i9.getStatus() == I9Status.REOPENED) {
                s2State = "AWAITING_HR";
                s2Sub = "Reopened — awaiting HR re-verification";
            } else {
                s2State = "NOT_STARTED";
                s2Sub = "Section 1 must be completed first";
            }
            items.add(CandidateDashboardResponse.ComplianceItem.builder()
                    .kind("I9_SECTION_2")
                    .label("Form I-9 — Section 2 (HR)")
                    .state(s2State)
                    .subtitle(s2Sub)
                    .href(null)
                    .completedAt(s2At)
                    .build());
        }

        // ── E-Verify (HR, post-I-9) ──────────────────────────────────────────
        WorkAuthTrack track = engagement != null ? engagement.getTrack() : null;
        EVerifyCase everify = i9 != null
                ? everifyCaseRepository.findByI9FormId(i9.getId()).orElse(null)
                : null;
        boolean everifyRelevant = track == WorkAuthTrack.STEM_OPT || everify != null;
        if (everifyRelevant) {
            String state;
            String sub;
            Instant at = null;
            if (everify == null) {
                state = "NOT_STARTED";
                sub = "HR will open the E-Verify case after Form I-9 is complete";
            } else if (everify.getStatus() == EVerifyStatus.EMPLOYMENT_AUTHORIZED) {
                state = "COMPLETED";
                sub = "Employment authorized";
            } else if (everify.getStatus() == EVerifyStatus.PENDING_SUBMISSION) {
                state = "IN_PROGRESS";
                sub = "Case created — HR will submit shortly";
            } else {
                state = "IN_PROGRESS";
                sub = "Case status: " + everify.getStatus().name();
            }
            items.add(CandidateDashboardResponse.ComplianceItem.builder()
                    .kind("EVERIFY")
                    .label("E-Verify")
                    .state(state)
                    .subtitle(sub)
                    .href(null)
                    .completedAt(at)
                    .build());
        }

        // ── I-983 Training Plan (STEM_OPT only) ──────────────────────────────
        if (track == WorkAuthTrack.STEM_OPT) {
            List<I983Plan> plans = i983PlanRepository
                    .findByCandidateIdOrderByCreatedAtDesc(candidateId);
            I983Plan latest = plans.isEmpty() ? null : plans.get(0);
            String state;
            String sub;
            if (latest == null) {
                state = "NOT_STARTED";
                sub = "ERM will draft your training plan";
            } else if (latest.getStatus() == I983Status.DSO_APPROVED) {
                state = "COMPLETED";
                sub = "DSO-approved";
            } else {
                state = "IN_PROGRESS";
                sub = "Status: " + latest.getStatus().name();
            }
            items.add(CandidateDashboardResponse.ComplianceItem.builder()
                    .kind("I983")
                    .label("Form I-983 Training Plan")
                    .state(state)
                    .subtitle(sub)
                    .href("/careers/candidate/training-plans")
                    .completedAt(null)
                    .build());
        }

        return items;
    }

    private String formatDate(Instant at) {
        if (at == null) return "—";
        return at.atZone(java.time.ZoneOffset.UTC)
                .toLocalDate()
                .format(java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy"));
    }

    private String lookupUserName(UUID userId) {
        if (userId == null) return null;
        return userRepository.findById(userId).map(User::getFullName).orElse(null);
    }

    // ── nextStep ─────────────────────────────────────────────────────────────

    private CandidateDashboardResponse.NextStep pickNextStep(
            List<Application> apps,
            List<Offer> offers,
            List<Interview> upcomingInterviews,
            List<OnboardingTask> tasks,
            int profileComplete,
            Engagement engagement) {

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

        // 2. Screening sent — candidate needs to complete it before the
        //    application can advance. Resolve the screening id so the CTA
        //    deep-links to the take-screening page. If the lookup fails (a
        //    stray SCREENING_SENT with no Screening row, which shouldn't
        //    happen post-1.1b but we don't want a 500) we fall through.
        Application withScreening = activeApps.stream()
                .filter(a -> a.getStatus() == ApplicationStatus.SCREENING_SENT)
                .findFirst()
                .orElse(null);
        if (withScreening != null) {
            UUID screeningId = screeningRepository
                    .findByApplicationIdWithGraph(withScreening.getId())
                    .map(s -> s.getId())
                    .orElse(null);
            if (screeningId != null) {
                String position = withScreening.getJobPosting() != null
                        ? withScreening.getJobPosting().getTitle()
                        : null;
                return CandidateDashboardResponse.NextStep.builder()
                        .type("SCREENING")
                        .title(position != null
                                ? "Complete screening — " + position
                                : "Complete screening")
                        .subtitle("A short questionnaire from the recruiter")
                        .ctaLabel("Take screening")
                        .ctaHref("/careers/screening/" + screeningId)
                        .build();
            }
        }

        // 3. Upcoming interview.
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
        // Phase 3 step 10 — engagement.status is the new source of truth.
        // Fallback to Application post-offer statuses for legacy candidates
        // that don't have an engagement yet (step-11 backfill cleans this up).
        boolean hasAcceptedOrHired = engagement != null
                ? (engagement.getStatus() == EngagementStatus.PENDING_COMPLIANCE
                        || engagement.getStatus() == EngagementStatus.READY_TO_START
                        || engagement.getStatus() == EngagementStatus.ACTIVE)
                : activeApps.stream().anyMatch(a -> a.getStatus() == ApplicationStatus.ACCEPTED
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

        // 4. ACTIVE intern — weekly work submission. Engagement-first; legacy
        // fallback for candidates pre-Phase-3 step-3.
        boolean isActiveIntern = engagement != null
                ? engagement.getStatus() == EngagementStatus.ACTIVE
                : activeApps.stream().anyMatch(a -> a.getStatus() == ApplicationStatus.HIRED
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
            // Phase 2.3 — conditional selection. Informational state on the
            // candidate side: they're picked but the formal offer hasn't been
            // sent yet, so there's no CTA — just reassurance.
            if (status == ApplicationStatus.SELECTED_CONDITIONAL) {
                return CandidateDashboardResponse.NextStep.builder()
                        .type("SELECTED_CONDITIONAL")
                        .title(position != null
                                ? "Conditionally selected — " + position
                                : "Conditionally selected")
                        .subtitle("Offer pending. HR will send the formal offer next.")
                        .ctaLabel("View application")
                        .ctaHref("/careers/candidate/applications")
                        .build();
            }
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
