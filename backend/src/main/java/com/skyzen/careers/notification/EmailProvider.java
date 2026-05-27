package com.skyzen.careers.notification;

import java.time.Instant;

/**
 * Single seam for outbound transactional email. Two implementations:
 *
 * <ul>
 *   <li>{@link SmtpEmailProvider} — real send via Spring's JavaMailSender.
 *       Active when {@code spring.mail.host} + {@code spring.mail.username}
 *       are configured. Throws {@link EmailDeliveryException} on failure so
 *       callers can decide whether to fail the request or swallow.</li>
 *   <li>{@link LogEmailProvider} — fallback. Logs at INFO and returns. Used
 *       in dev / CI / local where no SMTP is configured.</li>
 * </ul>
 *
 * Selection happens in {@link EmailProviderConfiguration}. Call sites stay
 * identical regardless of which one is wired.
 */
public interface EmailProvider {

    /** Send the 6-digit email-verification code. */
    void sendVerificationCode(String email, String code, Instant expiresAt);

    /** Send the post-verification "your Skyzen Applicant ID is X" notice. */
    void sendApplicantIdIssued(String email, String applicantId);

    /**
     * Send a password-reset link. The URL embeds the one-time token; the
     * implementation does NOT generate or persist the token itself.
     */
    void sendPasswordReset(String email, String resetUrl, Instant expiresAt);

    /**
     * Phase 2.3 — confirmation that the candidate was conditionally selected
     * for a role (post-scorecard, pre-formal-offer).
     */
    void sendConditionalSelectionConfirmation(String email,
                                              String jobPostingTitle,
                                              String entityName);
}
