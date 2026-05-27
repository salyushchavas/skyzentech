package com.skyzen.careers.notification;

/**
 * One value per distinct outbound notification. The (eventType, targetId)
 * tuple is the idempotency key — see {@link com.skyzen.careers.entity.SentNotification}.
 *
 * <p>Why separate {@code OFFER_ACCEPTED} from {@code OFFER_ACCEPTED_OPS}:
 * the same source event (an Offer flipping to ACCEPTED) fires two distinct
 * sends to two distinct recipients. Treating them as separate event types
 * means each gets its own idempotency row, which keeps the simple
 * "one row per send" model intact.</p>
 */
public enum NotificationEventType {

    // Auth flow (legacy — kept for completeness of the registry; these
    // still go through NotificationStub directly because they don't
    // need idempotency: re-issuing a fresh verification code is the
    // user-driven retry).
    VERIFICATION_CODE,
    APPLICANT_ID_ISSUED,
    PASSWORD_RESET,

    // Batch 1 — applicant lifecycle.
    APPLICATION_RECEIVED,        // confirmation to applicant on submit
    APPLICATION_SHORTLISTED,     // status flipped to SHORTLISTED
    APPLICATION_REJECTED,        // status flipped to REJECTED
    INTERVIEW_SCHEDULED,         // a new Interview row exists
    INTERVIEW_REMINDER,          // 24h before, scheduled job
    OFFER_EXTENDED,              // Offer.status SENT
    OFFER_ACCEPTED,              // applicant confirmation
    OFFER_ACCEPTED_OPS,          // notification to Operations
    ONBOARDING_WELCOME,          // engagement flipped to ACTIVE

    // Existing — recruiter conditional select (kept for the migration when
    // it moves under the unified NotificationService).
    CONDITIONAL_SELECT
}
