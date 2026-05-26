package com.skyzen.careers.enums;

/**
 * GAP_REPORT C1 — weekly training material lifecycle.
 *
 *   DRAFT     Supervisor is composing; not visible to interns.
 *   RELEASED  Visible to the target audience (broadcast = all ACTIVE interns,
 *             or scoped = a single engagement). Released materials are
 *             intentionally immutable in v1 — edit while DRAFT, release once,
 *             move on. (A future revision cycle is a follow-up scope decision.)
 */
public enum WeeklyMaterialStatus {
    DRAFT,
    RELEASED
}
