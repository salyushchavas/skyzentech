package com.skyzen.careers.intern;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.InternLifecycleStatus;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.service.ExitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static com.skyzen.careers.intern.InternDashboardResponse.*;

/**
 * Derives the intern dashboard mode and the full module / stepper /
 * next-action payload from {@link User#getLifecycleStatus()}. Single source
 * of truth — controllers and frontend pull from one shape so the doc
 * matrix is implemented exactly once.
 *
 * <p>Pure function of the user's lifecycle state; no DB writes. Future
 * phases will extend the contacts panel once {@code InternLifecycle} is
 * populated.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InternDashboardService {

    private final InternLifecycleRepository internLifecycleRepository;
    private final UserRepository userRepository;
    private final InternEvaluationService internEvaluationService;
    private final ExitService exitService;
    private final OfferRepository offerRepository;

    public InternDashboardResponse getDashboard(User caller) {
        InternLifecycleStatus status = caller.getLifecycleStatus() != null
                ? caller.getLifecycleStatus()
                : InternLifecycleStatus.REGISTERED;
        String mode = deriveMode(status);
        boolean emailVerified = Boolean.TRUE.equals(caller.getEmailVerified());
        // Phase 6: Step 8 "Evaluation Cycle" completes on first PUBLISHED /
        // ACKNOWLEDGED / AMENDED evaluation for this intern.
        boolean hasPublishedEval = false;
        try {
            hasPublishedEval = internEvaluationService
                    .internHasPublishedEvaluation(caller.getId());
        } catch (Exception e) {
            log.warn("evaluation check failed (non-fatal) for {}: {}",
                    caller.getId(), e.getMessage());
        }

        // Phase 8 — exit summary block only when intern is INACTIVE.
        ExitSummary exitSummary = "INACTIVE".equals(mode) ? loadExitSummary(caller) : null;
        boolean feedbackSubmitted = exitSummary != null && exitSummary.feedbackSubmitted();

        return new InternDashboardResponse(
                userSummary(caller),
                status,
                mode,
                emailVerified,
                buildStepper(caller, status, hasPublishedEval),
                buildModules(mode),
                buildNextAction(status, mode, emailVerified, exitSummary, feedbackSubmitted),
                buildContacts(caller),
                exitSummary,
                Instant.now()
        );
    }

    private ExitSummary loadExitSummary(User caller) {
        try {
            return exitService.getInternSummary(caller)
                    .map(s -> new ExitSummary(
                            s.exitType(),
                            s.exitDate(),
                            s.durationDays(),
                            s.projectsCompleted(),
                            s.evaluationsCount(),
                            s.averageScore(),
                            s.timesheetsApproved(),
                            s.totalApprovedHours(),
                            s.feedbackSubmitted(),
                            s.internVisibleSummary(),
                            s.finalEvaluationId()))
                    .orElse(null);
        } catch (Exception e) {
            log.warn("[Dashboard] exit summary lookup failed (non-fatal) for {}: {}",
                    caller.getId(), e.getMessage());
            return null;
        }
    }

    // ── Mode derivation ─────────────────────────────────────────────────────

    private String deriveMode(InternLifecycleStatus s) {
        return switch (s) {
            case REGISTERED, EMAIL_VERIFIED, APPLICATION_SUBMITTED -> "APPLICANT";
            case SHORTLISTED, INTERVIEW_SCHEDULED, INTERVIEW_COMPLETED -> "INTERVIEW";
            case OFFER_SENT -> "OFFER";
            case OFFER_SIGNED, EMPLOYEE_ID_CREATED, ONBOARDING_ASSIGNED -> "NEW_HIRE";
            case ONBOARDING_ACCEPTED, ACTIVE_INTERN -> "ACTIVE_INTERN";
            case INACTIVE_INTERN -> "INACTIVE";
        };
    }

    // ── Stepper ─────────────────────────────────────────────────────────────

    private static final String[][] STEPS = {
            {"registered",       "Registered"},
            {"email_verified",   "Email Verified"},
            {"applied",          "Applied"},
            {"interview",        "Interview"},
            {"offer",            "Offer"},
            {"onboarding",       "Onboarding"},
            {"active_intern",    "Active Intern"},
            {"evaluation_cycle", "Evaluation Cycle"},
            {"completed",        "Completed / Inactive"},
    };

    private List<StepperStep> buildStepper(User caller, InternLifecycleStatus s,
                                            boolean hasPublishedEval) {
        // For each step compute the done-predicate. Active = first not-done.
        boolean[] done = new boolean[STEPS.length];
        done[0] = true; // Step 1 — user exists by virtue of being logged in
        done[1] = atLeast(s, InternLifecycleStatus.EMAIL_VERIFIED);
        done[2] = atLeast(s, InternLifecycleStatus.APPLICATION_SUBMITTED);
        done[3] = atLeast(s, InternLifecycleStatus.INTERVIEW_COMPLETED);
        done[4] = atLeast(s, InternLifecycleStatus.OFFER_SIGNED);
        done[5] = atLeast(s, InternLifecycleStatus.ONBOARDING_ACCEPTED);
        done[6] = atLeast(s, InternLifecycleStatus.ACTIVE_INTERN);
        // Phase 6: Step 8 completes on first PUBLISHED evaluation. Also marked
        // DONE if the intern is INACTIVE (cycle implicitly finished).
        done[7] = hasPublishedEval || s == InternLifecycleStatus.INACTIVE_INTERN;
        done[8] = s == InternLifecycleStatus.INACTIVE_INTERN;

        int firstActive = -1;
        for (int i = 0; i < done.length; i++) {
            if (!done[i]) { firstActive = i; break; }
        }

        // Phase 8.9.1 — the start-date gate is gone, so an intern at
        // ONBOARDING_ACCEPTED with a signed offer flips immediately via the
        // doc-completion trigger. The only remaining "parked at Active
        // Intern" case is the defensive one where onboarding was accepted
        // but no SIGNED offer exists — surfaced as "Pending offer signing".
        String activeIntenReason = null;
        if (firstActive == 6 && s == InternLifecycleStatus.ONBOARDING_ACCEPTED) {
            activeIntenReason = computeActivationReason(caller);
        }

        List<StepperStep> out = new ArrayList<>(STEPS.length);
        for (int i = 0; i < STEPS.length; i++) {
            String state = done[i] ? "DONE"
                    : (i == firstActive ? "ACTIVE" : "UPCOMING");
            String reason = (i == 6) ? activeIntenReason : null;
            out.add(new StepperStep(STEPS[i][0], STEPS[i][1], state, reason));
        }
        return out;
    }

    /**
     * Phase 8.9.1 — subtitle for a ONBOARDING_ACCEPTED intern still parked
     * at the Active Intern node. The start-date gate is gone, so the only
     * remaining reason an intern lingers here is a missing SIGNED offer
     * (a defensive edge case — onboarding shouldn't normally have been
     * accepted without one). Returns null when the offer is signed, since
     * the doc-completion trigger should be activating the intern within
     * seconds; a transient mid-window subtitle would just churn the UI.
     */
    private String computeActivationReason(User caller) {
        try {
            List<Offer> offers = offerRepository
                    .findByApplication_Candidate_User_IdOrderByCreatedAtDesc(caller.getId());
            boolean hasSignedOffer = offers.stream().anyMatch(o ->
                    o.getStatus() == OfferStatus.SIGNED
                            || o.getStatus() == OfferStatus.ACCEPTED);
            if (!hasSignedOffer) return "Pending offer signing";
            // Signed + onboarding accepted ⇒ activation fires immediately
            // via the doc-completion trigger. No subtitle needed.
            return null;
        } catch (Exception e) {
            log.warn("[Dashboard] activation reason lookup failed (non-fatal) for {}: {}",
                    caller.getId(), e.getMessage());
            return null;
        }
    }

    private boolean atLeast(InternLifecycleStatus current, InternLifecycleStatus floor) {
        return current.ordinal() >= floor.ordinal();
    }

    // ── Modules ─────────────────────────────────────────────────────────────

    private Modules buildModules(String mode) {
        boolean inactive = "INACTIVE".equals(mode);

        ModuleState home = new ModuleState(true, false, inactive);

        // Job Postings
        ModuleState jobs = switch (mode) {
            case "APPLICANT"  -> new ModuleState(true, false, false);
            case "INTERVIEW"  -> new ModuleState(true, false, true);
            default           -> new ModuleState(true, true, false);
        };

        // My Applications — visible from APPLICANT onward; read-only past OFFER stage
        boolean appsReadOnly = !(mode.equals("APPLICANT") || mode.equals("INTERVIEW"));
        ModuleState apps = new ModuleState(true, false, appsReadOnly);

        // Interview Center — locked for APPLICANT, read-only past INTERVIEW
        ModuleState interview = switch (mode) {
            case "APPLICANT" -> new ModuleState(true, true, false);
            case "INTERVIEW" -> new ModuleState(true, false, false);
            default          -> new ModuleState(true, false, true);
        };

        // Offer Letter — locked pre-OFFER; active in OFFER; signed copy after
        ModuleState offer = switch (mode) {
            case "APPLICANT", "INTERVIEW" -> new ModuleState(true, true, false);
            case "OFFER"                  -> new ModuleState(true, false, false);
            default                       -> new ModuleState(true, false, true);
        };

        // Onboarding — locked pre-NEW_HIRE; active in NEW_HIRE; read-only after
        ModuleState onboarding = switch (mode) {
            case "APPLICANT", "INTERVIEW", "OFFER" -> new ModuleState(true, true, false);
            case "NEW_HIRE"                        -> new ModuleState(true, false, false);
            default                                -> new ModuleState(true, false, true);
        };

        // My Projects / Timesheets / Evaluations — locked until ACTIVE_INTERN
        ModuleState projects = workModuleState(mode);
        ModuleState timesheets = workModuleState(mode);
        ModuleState evaluations = workModuleState(mode);

        // Documents — always visible; read-only when inactive
        ModuleState documents = new ModuleState(true, false, inactive);

        // Messages — visible for everyone except INACTIVE (locked)
        ModuleState messages = inactive
                ? new ModuleState(true, true, false)
                : new ModuleState(true, false, false);

        // Help — always visible
        ModuleState help = new ModuleState(true, false, false);

        return new Modules(home, jobs, apps, interview, offer, onboarding,
                projects, timesheets, evaluations, documents, messages, help);
    }

    private ModuleState workModuleState(String mode) {
        return switch (mode) {
            case "ACTIVE_INTERN" -> new ModuleState(true, false, false);
            case "INACTIVE"      -> new ModuleState(true, false, true);
            default              -> new ModuleState(true, true, false);
        };
    }

    // ── Next-action card ────────────────────────────────────────────────────

    private NextAction buildNextAction(InternLifecycleStatus s, String mode,
                                       boolean emailVerified,
                                       ExitSummary exitSummary,
                                       boolean feedbackSubmitted) {
        if (s == InternLifecycleStatus.INACTIVE_INTERN) {
            if (!feedbackSubmitted) {
                return action(
                        "Share your exit feedback",
                        "Help us improve future internships — takes about 3 minutes.",
                        "Open feedback form",
                        "/careers/intern/exit/feedback",
                        false, null);
            }
            String description = exitSummary != null && exitSummary.internVisibleSummary() != null
                    ? exitSummary.internVisibleSummary()
                    : "Your record is read-only. Download signed forms and feedback any time.";
            return action(
                    "Internship concluded",
                    description,
                    "View exit summary",
                    "/careers/intern/exit/summary",
                    false, null);
        }
        return switch (s) {
            case REGISTERED -> action(
                    "Verify your email",
                    "Check your inbox for the verification link.",
                    "Resend verification",
                    "/api/v1/auth/resend-verification",
                    false, null);
            case EMAIL_VERIFIED -> action(
                    "Apply to a job",   
                    "Browse open positions and submit your application.",
                    "Browse jobs", "/careers/intern/jobs",
                    false, null);
            case APPLICATION_SUBMITTED -> waiting(
                    "Application under review",
                    "ERM is reviewing your application. You'll hear back soon.",
                    "ERM");
            case SHORTLISTED -> waiting(
                    "Interview will be scheduled",
                    "You've been shortlisted. ERM will send your interview details shortly.",
                    "ERM");
            case INTERVIEW_SCHEDULED -> action(
                    "Interview scheduled",
                    "Join the Zoom call at the scheduled time.",
                    "View interview", "/careers/intern/interviews",
                    false, null);
            case INTERVIEW_COMPLETED -> waiting(
                    "Awaiting interview feedback",
                    "The interviewer is recording feedback.",
                    "ERM");
            case OFFER_SENT -> action(
                    "Sign your offer letter",
                    "Review and sign the offer through DocuSign.",
                    "Open offer", "/careers/intern/offer",
                    false, null);
            case OFFER_SIGNED -> waiting(
                    "Welcome! Setting up your account",
                    "Your employee ID is being created.",
                    "system");
            case EMPLOYEE_ID_CREATED -> waiting(
                    "Onboarding packet pending",
                    "ERM will assign your onboarding documents shortly.",
                    "ERM");
            case ONBOARDING_ASSIGNED -> action(
                    "Complete onboarding documents",
                    "W-4, I-9, ACH, emergency contact, handbook acknowledgment.",
                    "Open onboarding", "/careers/intern/onboarding",
                    false, null);
            case ONBOARDING_ACCEPTED -> waiting(
                    "Awaiting start date activation",
                    "Onboarding accepted. Your start date will activate your account.",
                    "system");
            case ACTIVE_INTERN -> action(
                    "View your current work",
                    "Check projects, weekly meetings, timesheets, and evaluations.",
                    "Open work", "/careers/intern/projects",
                    false, null);
            // INACTIVE_INTERN handled above (Phase 8 branch) — kept here to
            // satisfy exhaustive switch even though never reached.
            case INACTIVE_INTERN -> action(
                    "Internship concluded",
                    "Your record is read-only.",
                    "View exit summary", "/careers/intern/exit/summary",
                    false, null);
        };
    }

    private NextAction action(String title, String desc, String ctaLabel,
                              String ctaHref, boolean waiting, String waitingFor) {
        return new NextAction(title, desc, ctaLabel, ctaHref, waiting, waitingFor);
    }

    private NextAction waiting(String title, String desc, String waitingFor) {
        return new NextAction(title, desc, null, null, true, waitingFor);
    }

    // ── Contacts ────────────────────────────────────────────────────────────

    private Contacts buildContacts(User caller) {
        // Phase 5: populate from InternLifecycle.{trainerId, evaluatorId,
        // managerId, ermId} once the ERM has wired them via the assignment
        // endpoints. Pre-active interns get all-null contacts.
        try {
            InternLifecycle lc = internLifecycleRepository.findByUserId(caller.getId())
                    .orElse(null);
            if (lc == null) return new Contacts(null, null, null, null);
            return new Contacts(
                    lookupContact(lc.getErmId()),
                    lookupContact(lc.getTrainerId()),
                    lookupContact(lc.getEvaluatorId()),
                    lookupContact(lc.getManagerId()));
        } catch (Exception e) {
            log.warn("Contacts lookup failed (non-fatal) for {}: {}",
                    caller.getId(), e.getMessage());
            return new Contacts(null, null, null, null);
        }
    }

    private Contact lookupContact(UUID userId) {
        if (userId == null) return null;
        return userRepository.findById(userId)
                .map(u -> new Contact(
                        u.getFullName() != null ? u.getFullName() : u.getEmail(),
                        u.getEmail()))
                .orElse(null);
    }

    // ── User summary ────────────────────────────────────────────────────────

    private UserSummary userSummary(User u) {
        String first = "";
        String last = "";
        String full = u.getFullName();
        if (full != null && !full.isBlank()) {
            String[] parts = full.trim().split("\\s+", 2);
            first = parts[0];
            last = parts.length > 1 ? parts[1] : "";
        }
        return new UserSummary(
                first,
                last,
                u.getEmail(),
                u.getApplicantId(),
                u.getEmployeeId()
        );
    }
}
