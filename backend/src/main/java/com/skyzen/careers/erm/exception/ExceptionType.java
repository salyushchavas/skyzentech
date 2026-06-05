package com.skyzen.careers.erm.exception;

/** Phase 1 — 8 exception detection categories surfaced on the ERM Home. */
public enum ExceptionType {
    UNSIGNED_OFFER_OVERDUE,
    ONBOARDING_DOC_REJECTED,
    I9_EVERIFY_TIMING_RISK,
    NO_PROJECT_ASSIGNED,
    TRAINER_MEETING_MISSING,
    EVALUATION_OVERDUE,
    TIMESHEET_MISSING,
    EXIT_CHECKLIST_PENDING,
    /** ERM Phase 4 — new hire signed offer but reporting structure not assigned. */
    REPORTING_STRUCTURE_INCOMPLETE,
    /** ERM Phase 5 — work auth (EAD / I-20 / authorized_until) expiring within 30 days. */
    WORK_AUTH_EXPIRING_30,
    /** ERM Phase 5 — F-1 STEM OPT / CPT intern past required I-983 evaluation cadence. */
    I983_EVALUATION_OVERDUE,
    /** ERM Phase 5 — E-Verify case sitting in TENTATIVE_NONCONFIRMATION past expected_close_by. */
    EVERIFY_NONCONFIRMATION
}
