package com.skyzen.careers.enums;

/**
 * Role model — matches PED §7 exactly. The six dashboards each correspond
 * to one of these roles.
 *
 * <h2>Role flip on hire</h2>
 * A new registration starts as {@link #APPLICANT}. When the candidate's
 * engagement transitions to {@code ACTIVE} (hire),
 * {@code EngagementService.applyTransition} flips the user's role
 * APPLICANT → {@link #INTERN}. There is no INTERN-before-hire state — the
 * flip is the hire event from the user's perspective.
 *
 * <h2>Operations supremacy</h2>
 * {@link #OPERATIONS} holds the former ADMIN superuser powers in addition to
 * the day-to-day RECRUITER + ERM functions — there is no separate ADMIN role.
 *
 * <h2>EXECUTIVE</h2>
 * Leadership / read-only role. EXECUTIVEs see funnel metrics, compliance
 * health, and the audit log, but never mutate workflow state. No existing
 * user auto-maps to EXECUTIVE — operators create EXECUTIVE accounts
 * explicitly through the user-admin UI.
 */
public enum UserRole {
    APPLICANT,
    INTERN,
    HR_COMPLIANCE,
    OPERATIONS,
    TECHNICAL_SUPERVISOR,
    EXECUTIVE
}
