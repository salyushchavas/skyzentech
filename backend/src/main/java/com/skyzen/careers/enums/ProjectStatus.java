package com.skyzen.careers.enums;

/**
 * Project lifecycle. Distinct from {@link WorkAssignmentStatus} because
 * Projects are long-running deliverables with multiple submissions, a
 * checklist, and a split review outcome — Returned (intern fixes) vs
 * Completed (terminal lock).
 *
 * <pre>
 *   NOT_STARTED  Created by supervisor; intern hasn't started.
 *   IN_PROGRESS  Intern moved off the starting line; can update progress.
 *   SUBMITTED    Intern sent the deliverables; supervisor reviews next.
 *   RETURNED     Supervisor sent back with feedback; intern updates + resubmits.
 *   COMPLETED    Terminal. Locked — no edits, no resubmits.
 * </pre>
 */
public enum ProjectStatus {
    NOT_STARTED,
    IN_PROGRESS,
    SUBMITTED,
    RETURNED,
    COMPLETED
}
