package com.skyzen.careers.application;

import com.skyzen.careers.enums.ApplicationStatus;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Single source of truth for the application status lifecycle.
 *
 * Three things live here:
 *  - {@link #stageIndexOf(ApplicationStatus)} — the 5-stage stepper mapping
 *    (0 Applied → 1 Shortlisted → 2 Interview → 3 Offer → 4 Hired), with -1
 *    for exit statuses.
 *  - {@link #isExited(ApplicationStatus)} — whether the application has left
 *    the funnel (REJECTED / WITHDRAWN / LAPSED / NO_SHOW).
 *  - {@link #LEGAL_TRANSITIONS} — the gated state machine. Defined now,
 *    enforced in phase 1.1b. Existing write-sites are unaware of this table
 *    until then; same-state self-transitions are considered legal no-ops.
 *
 * NO behavior change in this commit: the two duplicated stageIndex helpers
 * in {@code CandidateDashboardService} + {@code CandidateApplicationsService}
 * — and their local EXIT_STATUSES sets — now delegate here.
 */
public final class ApplicationLifecycle {

    private ApplicationLifecycle() {}

    /** Statuses outside the funnel; surfaced as {@code isExited=true} on the wire. */
    private static final Set<ApplicationStatus> EXIT_STATUSES = EnumSet.of(
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
            ApplicationStatus.LAPSED,
            ApplicationStatus.NO_SHOW);

    /**
     * 5-stage stepper index. Returns 0 for {@code null} (same fallback the
     * original helpers used so the stepper has a sane default for partial
     * data). Returns -1 for exit statuses — the frontend renders those with
     * the {@code isExited} treatment, not a stage.
     */
    public static int stageIndexOf(ApplicationStatus s) {
        if (s == null) return 0;
        return switch (s) {
            case APPLIED -> 0;
            case SHORTLISTED -> 1;
            case INTERVIEW_SCHEDULED, INTERVIEWED -> 2;
            case OFFERED, ACCEPTED -> 3;
            case ONBOARDING, ACTIVE, HIRED, COMPLETED -> 4;
            // Exit statuses (REJECTED/WITHDRAWN/LAPSED/NO_SHOW) are not on
            // the stepper — callers gate by isExited() first.
            default -> -1;
        };
    }

    /** True for the four exit statuses; false for null and for in-funnel values. */
    public static boolean isExited(ApplicationStatus s) {
        return s != null && EXIT_STATUSES.contains(s);
    }

    /**
     * Gated transition table. {@code from -> { allowed to-values }}.
     *
     * Same-state self-transitions are treated as legal no-ops by the
     * (forthcoming) guard; they are NOT listed here. Terminal states have
     * an empty set — nothing legal moves out of them.
     *
     * The guard in phase 1.1b consults this map. Until then, every call
     * site still calls {@code application.setStatus(...)} directly; this
     * map is informational and tested for self-consistency by callers
     * that care.
     */
    public static final Map<ApplicationStatus, Set<ApplicationStatus>> LEGAL_TRANSITIONS = Map.ofEntries(
            Map.entry(ApplicationStatus.APPLIED, EnumSet.of(
                    ApplicationStatus.SHORTLISTED,
                    ApplicationStatus.REJECTED,
                    ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.SHORTLISTED, EnumSet.of(
                    ApplicationStatus.INTERVIEW_SCHEDULED,
                    ApplicationStatus.REJECTED,
                    ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.INTERVIEW_SCHEDULED, EnumSet.of(
                    ApplicationStatus.INTERVIEWED,
                    ApplicationStatus.INTERVIEW_SCHEDULED, // legal re-schedule
                    ApplicationStatus.NO_SHOW,
                    ApplicationStatus.REJECTED,
                    ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.INTERVIEWED, EnumSet.of(
                    ApplicationStatus.OFFERED,
                    ApplicationStatus.REJECTED,
                    ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.OFFERED, EnumSet.of(
                    ApplicationStatus.ACCEPTED,
                    ApplicationStatus.REJECTED,
                    ApplicationStatus.WITHDRAWN,
                    ApplicationStatus.LAPSED)),
            Map.entry(ApplicationStatus.ACCEPTED, EnumSet.of(
                    ApplicationStatus.ONBOARDING,
                    ApplicationStatus.HIRED,
                    ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.ONBOARDING, EnumSet.of(
                    ApplicationStatus.ACTIVE,
                    ApplicationStatus.HIRED,
                    ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.HIRED, EnumSet.of(
                    ApplicationStatus.ACTIVE,
                    ApplicationStatus.COMPLETED,
                    ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.ACTIVE, EnumSet.of(
                    ApplicationStatus.COMPLETED,
                    ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.COMPLETED, EnumSet.noneOf(ApplicationStatus.class)),
            Map.entry(ApplicationStatus.NO_SHOW, EnumSet.of(
                    ApplicationStatus.REJECTED,
                    ApplicationStatus.WITHDRAWN)),
            // Terminal exits — nothing moves out.
            Map.entry(ApplicationStatus.REJECTED, EnumSet.noneOf(ApplicationStatus.class)),
            Map.entry(ApplicationStatus.WITHDRAWN, EnumSet.noneOf(ApplicationStatus.class)),
            Map.entry(ApplicationStatus.LAPSED, EnumSet.noneOf(ApplicationStatus.class)));
}
