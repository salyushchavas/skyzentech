package com.skyzen.careers.intern;

import com.skyzen.careers.enums.InternLifecycleStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Single payload that drives the entire intern surface — mode, stepper,
 * module visibility, the Home page's next-action card, the right-side
 * contact panel, and (Phase 8) the exit summary block when the intern is
 * INACTIVE. Shape mirrors the Phase 1 doc (§3 + §4) plus the Phase 8
 * exit extensions.
 */
public record InternDashboardResponse(
        UserSummary user,
        InternLifecycleStatus lifecycleStatus,
        String mode,
        boolean emailVerified,
        List<StepperStep> stepper,
        Modules modules,
        NextAction nextAction,
        Contacts contacts,
        ExitSummary exitSummary,
        Instant lastUpdatedAt
) {
    public record UserSummary(
            String firstName,
            String lastName,
            String email,
            String applicantId,
            String employeeId
    ) {}

    public record StepperStep(
            String key,
            String label,
            String status // "DONE" | "ACTIVE" | "UPCOMING"
    ) {}

    public record Modules(
            ModuleState home,
            ModuleState jobPostings,
            ModuleState myApplications,
            ModuleState interviewCenter,
            ModuleState offerLetter,
            ModuleState onboarding,
            ModuleState myProjects,
            ModuleState timesheets,
            ModuleState evaluations,
            ModuleState documents,
            ModuleState messages,
            ModuleState help
    ) {}

    public record ModuleState(
            boolean visible,
            boolean locked,
            boolean readOnly
    ) {}

    public record NextAction(
            String title,
            String description,
            String ctaLabel,
            String ctaHref,
            boolean waiting,
            String waitingFor
    ) {}

    public record Contacts(
            Contact erm,
            Contact trainer,
            Contact evaluator,
            Contact manager
    ) {}

    public record Contact(
            String name,
            String email
    ) {}

    /**
     * Phase 8 — present only when {@code mode == "INACTIVE"}. Powers the
     * Home exit-summary card and the /careers/intern/exit/summary page.
     */
    public record ExitSummary(
            String exitType,
            LocalDate exitDate,
            long durationDays,
            long projectsCompleted,
            long evaluationsCount,
            Double averageScore,
            long timesheetsApproved,
            BigDecimal totalApprovedHours,
            boolean feedbackSubmitted,
            String internVisibleSummary,
            UUID finalEvaluationId
    ) {}
}
