package com.skyzen.careers.enums;

/**
 * Role model — matches PED §7 + a separate SUPER_ADMIN god-mode owner role
 * sitting above the six dashboard roles.
 *
 * <h2>Role flip on hire</h2>
 * A new registration starts as {@link #APPLICANT}. When the candidate's
 * engagement transitions to {@code ACTIVE} (hire),
 * {@code EngagementService.applyTransition} flips the user's role
 * APPLICANT → {@link #INTERN}. The hire event IS the role flip.
 *
 * <h2>Operations vs Super admin</h2>
 * After the §7 refactor, {@link #OPERATIONS} holds the recruiter / ERM day-
 * to-day duties (pipeline, postings, interviews, onboarding orchestration).
 * Owner-level god-mode (user management, role management, system config,
 * full audit log, I-9 admin overrides) lives ONLY on {@link #SUPER_ADMIN}.
 * The bootstrap admin (driven by ADMIN_EMAIL / ADMIN_PASSWORD env vars) is
 * created as SUPER_ADMIN. SUPER_ADMIN does NOT inherit OPERATIONS scope —
 * a user who needs both must be assigned both roles.
 *
 * <h2>EXECUTIVE</h2>
 * Read-only leadership. EXECUTIVE sees funnel metrics, compliance health,
 * and the audit log (per PED §7), but never mutates workflow state. No
 * existing user auto-maps to EXECUTIVE — operators create EXECUTIVE
 * accounts explicitly through the user-admin UI.
 */
public enum UserRole {
    APPLICANT,
    INTERN,
    HR,
    OPERATIONS,
    TECHNICAL_EVALUATOR,
    /**
     * Reporting Manager — second reviewer on a project after the technical
     * supervisor approves. Runs the post-merge viva and signs off on final
     * completion. Distinct from TECHNICAL_EVALUATOR so the same engagement
     * can carry both reviewers and the workflow can enforce two sign-offs.
     */
    REPORTING_MANAGER,
    EXECUTIVE,
    SUPER_ADMIN
}
