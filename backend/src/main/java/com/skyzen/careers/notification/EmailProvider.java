package com.skyzen.careers.notification;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Single seam for outbound transactional email. Two implementations:
 *
 * <ul>
 *   <li>{@link SmtpEmailProvider} — real send via Spring's JavaMailSender.
 *       Active when {@code spring.mail.host} + {@code spring.mail.username}
 *       are configured. Throws {@link EmailDeliveryException} on failure.</li>
 *   <li>{@link LogEmailProvider} — fallback. Logs at INFO and returns. Used
 *       in dev / CI / local where no SMTP is configured.</li>
 * </ul>
 *
 * Every method renders into the shared branded template (see
 * {@code SmtpEmailProvider#wrapHtml}) so all outgoing mail looks identical
 * to the verification email.
 */
public interface EmailProvider {

    // ── Auth flow (existing) ────────────────────────────────────────────────

    void sendVerificationCode(String email, String code, Instant expiresAt);

    void sendApplicantIdIssued(String email, String applicantId);

    void sendPasswordReset(String email, String resetUrl, Instant expiresAt);

    void sendConditionalSelectionConfirmation(String email,
                                              String jobPostingTitle,
                                              String entityName);

    // ── Batch 1 — applicant lifecycle ───────────────────────────────────────

    /** Confirmation to applicant immediately after submitting an application. */
    void sendApplicationReceived(String email,
                                 String candidateName,
                                 String jobTitle,
                                 String entityName);

    /** Status flipped to SHORTLISTED. */
    void sendApplicationShortlisted(String email,
                                    String candidateName,
                                    String jobTitle,
                                    String entityName);

    /** Status flipped to REJECTED. Polite copy. */
    void sendApplicationRejected(String email,
                                 String candidateName,
                                 String jobTitle,
                                 String entityName);

    /** A new Interview row exists — applicant gets details. */
    void sendInterviewScheduled(String email,
                                String candidateName,
                                String jobTitle,
                                String entityName,
                                Instant scheduledAt,
                                Integer durationMinutes,
                                String interviewType,
                                String interviewerName,
                                String meetingUrl,
                                String candidateNotes);

    /** 24h before an interview. Same fields as scheduled, different framing. */
    void sendInterviewReminder(String email,
                               String candidateName,
                               String jobTitle,
                               String entityName,
                               Instant scheduledAt,
                               Integer durationMinutes,
                               String interviewType,
                               String interviewerName,
                               String meetingUrl);

    /** Offer extended — applicant. */
    void sendOfferExtended(String email,
                           String candidateName,
                           String jobTitle,
                           String entityName,
                           BigDecimal compensationAmount,
                           String compensationCurrency,
                           String compensationFrequency,
                           LocalDate startDate,
                           Instant expiresAt,
                           String viewOfferUrl);

    /** Offer accepted — applicant confirmation. */
    void sendOfferAccepted(String email,
                           String candidateName,
                           String jobTitle,
                           String entityName,
                           LocalDate startDate);

    /** Offer accepted — Operations notification (different recipient + framing). */
    void sendOfferAcceptedToOps(String opsEmail,
                                String candidateName,
                                String candidateEmail,
                                String jobTitle,
                                String entityName,
                                LocalDate startDate);

    /** Engagement flipped to ACTIVE — welcome the new intern. */
    void sendOnboardingWelcome(String email,
                               String internName,
                               String jobTitle,
                               String entityName,
                               LocalDate startDate,
                               String dashboardUrl);
}
