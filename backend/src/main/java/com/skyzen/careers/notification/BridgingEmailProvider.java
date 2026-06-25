package com.skyzen.careers.notification;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.MailHandoverState;
import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import com.skyzen.careers.mail.service.MailMessageService;
import com.skyzen.careers.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Mail bridge Phase 2 — {@code @Primary} wrapper around the raw
 * {@link EmailProvider} ({@code SmtpEmailProvider} in prod,
 * {@code LogEmailProvider} in dev/CI). Spring resolves every
 * {@code EmailProvider} dependency to this bean; the raw provider is
 * injected via {@code @Qualifier("rawEmailProvider")}.
 *
 * <h2>What it does</h2>
 * For the two generic seams {@link #sendRendered} and
 * {@link #sendBrandedHtml}, it intercepts the outgoing send:
 * <ol>
 *   <li>Look up the recipient {@link User} by the target email.</li>
 *   <li>If that user is {@code mailHandoverState == ACTIVATED} AND has a
 *       linked {@code mailAccountId}: resolve their company-mailbox
 *       address from {@link MailAccountRepository}, then call
 *       {@link MailMessageService#deliverInternalNotification} with the
 *       SAME subject + bodies — sender = {@code <localPart>@<seed-domain>}
 *       where {@code localPart} comes from
 *       {@link NotificationSenderContext} (set by
 *       {@link NotificationService#deliver}) or {@code noreply} as the
 *       safe default. <b>Phase 2 is internal-only — SMTP is NOT also
 *       called.</b></li>
 *   <li>Else (the only branch reachable today, since no user is
 *       ACTIVATED): delegate to the raw provider unchanged →
 *       byte-identical SMTP behaviour.</li>
 * </ol>
 *
 * <p>All ~30 typed methods on {@link EmailProvider} pass straight through
 * to the raw provider — they have rich typed signatures (names, dates,
 * URLs) and the SMTP implementation builds the subject + body inside
 * itself, so there is no usable {@code (subject, body)} pair for the
 * bridge to re-route. When those callers want internal routing, the
 * caller will be migrated to {@link #sendRendered} /
 * {@link #sendBrandedHtml} in a later phase.</p>
 *
 * <h2>Fail-safe</h2>
 * Internal routing is wrapped in try/catch: if recipient lookup or the
 * internal injector throws, we log a warning and fall through to the raw
 * provider. A routing bug can never silently drop a notification.
 *
 * <h2>Dormancy guarantee</h2>
 * The internal branch fires only when {@code recipient.mailHandoverState
 * == ACTIVATED && recipient.mailAccountId != null}. Phase 1 sets every
 * existing row to {@code PERSONAL}; no flow in the codebase flips a user
 * to {@code ACTIVATED} yet. Every send today therefore takes the
 * else-branch and behaves byte-identically to pre-phase.
 */
@Component
@Primary
@Slf4j
public class BridgingEmailProvider implements EmailProvider {

    private final EmailProvider raw;
    private final MailMessageService mailMessageService;
    private final UserRepository userRepository;
    private final MailAccountRepository mailAccountRepository;

    /** Same key {@code MailAdminSeeder} + {@code MailRoleAccountSeeder} use. */
    @Value("${app.webmail.seed.admin-domain:skyzentech.com}")
    private String seedDomain;

    public BridgingEmailProvider(@Qualifier("rawEmailProvider") EmailProvider raw,
                                  MailMessageService mailMessageService,
                                  UserRepository userRepository,
                                  MailAccountRepository mailAccountRepository) {
        this.raw = raw;
        this.mailMessageService = mailMessageService;
        this.userRepository = userRepository;
        this.mailAccountRepository = mailAccountRepository;
    }

    // ── Intercepted: the two generic seams ────────────────────────────────

    @Override
    public void sendRendered(String email, String subject, String body) {
        String internalAddr = internalRecipientFor(email);
        if (internalAddr != null) {
            String senderAddr = resolveSenderAddr();
            if (deliverInternal(senderAddr, internalAddr, subject, body, null)) return;
            // Diagnostic: deliverInternal returned false (its catch logged the
            // underlying cause); caller-side visibility for the SMTP fallback.
            log.warn("[MailBridge] internal delivery returned false for {} (from={}) "
                    + "→ falling back to SMTP", internalAddr, senderAddr);
        }
        raw.sendRendered(email, subject, body);
    }

    @Override
    public void sendBrandedHtml(String email, String subject, String plainBody, String htmlBody) {
        String internalAddr = internalRecipientFor(email);
        if (internalAddr != null) {
            String senderAddr = resolveSenderAddr();
            if (deliverInternal(senderAddr, internalAddr, subject, plainBody, htmlBody)) return;
            log.warn("[MailBridge] internal delivery returned false for {} (from={}) "
                    + "→ falling back to SMTP", internalAddr, senderAddr);
        }
        raw.sendBrandedHtml(email, subject, plainBody, htmlBody);
    }

    /**
     * Pulled out of {@link #deliverInternal} so the caller can log the resolved
     * sender address alongside the recipient when the internal path bails.
     * Same value as before — context local-part if set,
     * {@link NotificationSenderRoles#DEFAULT_LOCAL_PART} otherwise — at
     * {@code seedDomain}.
     */
    private String resolveSenderAddr() {
        String senderLocalPart = NotificationSenderContext.get();
        if (senderLocalPart == null || senderLocalPart.isBlank()) {
            senderLocalPart = NotificationSenderRoles.DEFAULT_LOCAL_PART;
        }
        return senderLocalPart + "@" + seedDomain;
    }

    /**
     * Mail bridge Phase 5 (revised) — 2-way routing. Returns the
     * company-mailbox address when the recipient User is
     * {@code ACTIVATED} and has a healthy linked mail account;
     * returns {@code null} for everything else (the caller then
     * delegates to the raw provider, i.e. external SMTP to whatever
     * address was passed in). The Phase-4 {@code REDIRECT_PERSONAL}
     * branch is gone — assign-time {@code mail_handover_state} is now
     * set straight to {@code ACTIVATED}, so internal routing begins at
     * handover with no intermediate window. PERSONAL users continue
     * to receive external email unchanged.
     *
     * <p>Comma-joined blast lists, unknown emails, missing/malformed
     * linked mailbox, and any lookup error all return {@code null}
     * (external passthrough) — the bridge never DROPS a send.</p>
     */
    private String internalRecipientFor(String recipientEmail) {
        if (recipientEmail == null || recipientEmail.isBlank()) return null;
        if (recipientEmail.contains(",")) return null;
        try {
            String lookupKey = recipientEmail.trim();
            Optional<User> recipientOpt = userRepository.findByEmail(lookupKey);
            if (recipientOpt.isEmpty()) {
                log.info("[MailBridge] route-miss: findByEmail empty for [{}] "
                        + "(len={}) → external SMTP", lookupKey, lookupKey.length());
                return null;
            }
            User recipient = recipientOpt.get();
            if (recipient.getMailHandoverState() != MailHandoverState.ACTIVATED) {
                log.info("[MailBridge] route-miss: user {} state={} (not ACTIVATED) "
                        + "→ external SMTP",
                        recipient.getId(), recipient.getMailHandoverState());
                return null;
            }
            UUID mailAccountId = recipient.getMailAccountId();
            if (mailAccountId == null) {
                log.info("[MailBridge] route-miss: user {} is ACTIVATED but "
                        + "mail_account_id is null → external SMTP", recipient.getId());
                return null;
            }
            MailAccount recipientMailbox = mailAccountRepository.findById(mailAccountId).orElse(null);
            if (recipientMailbox == null
                    || recipientMailbox.getDomain() == null
                    || recipientMailbox.getLocalPart() == null) {
                log.warn("[MailBridge] user {} is ACTIVATED but mail_account {} is "
                        + "missing/malformed — falling back to SMTP",
                        recipient.getId(), mailAccountId);
                return null;
            }
            return recipientMailbox.getLocalPart() + "@"
                    + recipientMailbox.getDomain().getName();
        } catch (Exception e) {
            log.warn("[MailBridge] routing decision failed for {} (falling back to SMTP): {}",
                    recipientEmail, e.getMessage());
            return null;
        }
    }

    /**
     * Execute the INTERNAL branch — drop the message into the linked
     * mailbox via {@link MailMessageService#deliverInternalNotification}.
     * Returns {@code false} on any failure so the caller can fall back
     * to the raw SMTP provider — the bridge never drops a notification.
     */
    private boolean deliverInternal(String senderAddr, String recipientAddr, String subject,
                                     String bodyText, String bodyHtml) {
        try {
            mailMessageService.deliverInternalNotification(
                    senderAddr, recipientAddr, subject, bodyText, bodyHtml);
            return true;
        } catch (Exception e) {
            log.warn("[MailBridge] internal delivery failed from={} to={} (falling back to SMTP): {}",
                    senderAddr, recipientAddr, e.getMessage());
            return false;
        }
    }

    // ── All other methods: delegate unchanged to the raw provider ─────────

    @Override
    public void sendVerificationCode(String email, String code, Instant expiresAt) {
        raw.sendVerificationCode(email, code, expiresAt);
    }

    @Override
    public void sendApplicantIdIssued(String email, String applicantId) {
        raw.sendApplicantIdIssued(email, applicantId);
    }

    @Override
    public void sendPasswordReset(String email, String resetUrl, Instant expiresAt) {
        raw.sendPasswordReset(email, resetUrl, expiresAt);
    }

    @Override
    public void sendConditionalSelectionConfirmation(String email, String jobPostingTitle, String entityName) {
        raw.sendConditionalSelectionConfirmation(email, jobPostingTitle, entityName);
    }

    @Override
    public void sendApplicationReceived(String email, String candidateName, String jobTitle, String entityName) {
        raw.sendApplicationReceived(email, candidateName, jobTitle, entityName);
    }

    @Override
    public void sendApplicationShortlisted(String email, String candidateName, String jobTitle, String entityName) {
        raw.sendApplicationShortlisted(email, candidateName, jobTitle, entityName);
    }

    @Override
    public void sendApplicationRejected(String email, String candidateName, String jobTitle, String entityName) {
        raw.sendApplicationRejected(email, candidateName, jobTitle, entityName);
    }

    @Override
    public void sendInterviewScheduled(String email, String candidateName, String jobTitle, String entityName,
                                        Instant scheduledAt, Integer durationMinutes, String interviewType,
                                        String interviewerName, String meetingUrl, String candidateNotes) {
        raw.sendInterviewScheduled(email, candidateName, jobTitle, entityName, scheduledAt,
                durationMinutes, interviewType, interviewerName, meetingUrl, candidateNotes);
    }

    @Override
    public void sendInterviewReminder(String email, String candidateName, String jobTitle, String entityName,
                                       Instant scheduledAt, Integer durationMinutes, String interviewType,
                                       String interviewerName, String meetingUrl) {
        raw.sendInterviewReminder(email, candidateName, jobTitle, entityName, scheduledAt,
                durationMinutes, interviewType, interviewerName, meetingUrl);
    }

    @Override
    public void sendOfferExtended(String email, String candidateName, String jobTitle, String entityName,
                                   BigDecimal compensationAmount, String compensationCurrency,
                                   String compensationFrequency, LocalDate startDate, Instant expiresAt,
                                   String viewOfferUrl) {
        raw.sendOfferExtended(email, candidateName, jobTitle, entityName, compensationAmount,
                compensationCurrency, compensationFrequency, startDate, expiresAt, viewOfferUrl);
    }

    @Override
    public void sendOfferAccepted(String email, String candidateName, String jobTitle, String entityName,
                                   LocalDate startDate) {
        raw.sendOfferAccepted(email, candidateName, jobTitle, entityName, startDate);
    }

    @Override
    public void sendOfferAcceptedToOps(String opsEmail, String candidateName, String candidateEmail,
                                        String jobTitle, String entityName, LocalDate startDate) {
        raw.sendOfferAcceptedToOps(opsEmail, candidateName, candidateEmail, jobTitle, entityName, startDate);
    }

    @Override
    public void sendOnboardingWelcome(String email, String internName, String jobTitle, String entityName,
                                       LocalDate startDate, String dashboardUrl) {
        raw.sendOnboardingWelcome(email, internName, jobTitle, entityName, startDate, dashboardUrl);
    }

    @Override
    public void sendI9Section1Reminder(String email, String internName, LocalDate section1DueDate,
                                        String dashboardUrl) {
        raw.sendI9Section1Reminder(email, internName, section1DueDate, dashboardUrl);
    }

    @Override
    public void sendI9Section2Pending(String hrEmail, String internName, LocalDate section2DueDate,
                                       String hrDashboardUrl) {
        raw.sendI9Section2Pending(hrEmail, internName, section2DueDate, hrDashboardUrl);
    }

    @Override
    public void sendI983PlanNeeded(String email, String internName, String dashboardUrl) {
        raw.sendI983PlanNeeded(email, internName, dashboardUrl);
    }

    @Override
    public void sendI983PlanReady(String hrEmail, String internName, String hrDashboardUrl) {
        raw.sendI983PlanReady(hrEmail, internName, hrDashboardUrl);
    }

    @Override
    public void sendEVerifyCaseOpened(String email, String internName, String dashboardUrl) {
        raw.sendEVerifyCaseOpened(email, internName, dashboardUrl);
    }

    @Override
    public void sendEVerifyTncAlert(String email, String internName, String dashboardUrl) {
        raw.sendEVerifyTncAlert(email, internName, dashboardUrl);
    }

    @Override
    public void sendEVerifyCleared(String email, String internName, String dashboardUrl) {
        raw.sendEVerifyCleared(email, internName, dashboardUrl);
    }

    @Override
    public void sendWorkAuthExpiryReminder(String email, String internName, int daysUntilExpiry,
                                            LocalDate expirationDate, String authType, String dashboardUrl) {
        raw.sendWorkAuthExpiryReminder(email, internName, daysUntilExpiry, expirationDate, authType, dashboardUrl);
    }

    @Override
    public void sendComplianceTaskReminder(String email, String internName, String taskTitle,
                                            LocalDate dueDate, Integer daysOverdue, String dashboardUrl) {
        raw.sendComplianceTaskReminder(email, internName, taskTitle, dueDate, daysOverdue, dashboardUrl);
    }

    @Override
    public void sendWeeklyReportDue(String email, String internName, LocalDate weekStart, String dashboardUrl) {
        raw.sendWeeklyReportDue(email, internName, weekStart, dashboardUrl);
    }

    @Override
    public void sendWeeklyReportReturned(String email, String internName, LocalDate weekStart,
                                          String reviewNotes, String dashboardUrl) {
        raw.sendWeeklyReportReturned(email, internName, weekStart, reviewNotes, dashboardUrl);
    }

    @Override
    public void sendWeeklyReportApproved(String email, String internName, LocalDate weekStart,
                                          String dashboardUrl) {
        raw.sendWeeklyReportApproved(email, internName, weekStart, dashboardUrl);
    }

    @Override
    public void sendTimesheetDue(String email, String internName, LocalDate weekStart, String dashboardUrl) {
        raw.sendTimesheetDue(email, internName, weekStart, dashboardUrl);
    }

    @Override
    public void sendProjectAssigned(String email, String internName, String projectTitle, LocalDate dueDate,
                                     String supervisorName, String dashboardUrl) {
        raw.sendProjectAssigned(email, internName, projectTitle, dueDate, supervisorName, dashboardUrl);
    }

    @Override
    public void sendProjectSubmitted(String supervisorEmail, String supervisorName, String internName,
                                      String projectTitle, String supervisorDashboardUrl) {
        raw.sendProjectSubmitted(supervisorEmail, supervisorName, internName, projectTitle, supervisorDashboardUrl);
    }

    @Override
    public void sendProjectReturned(String email, String internName, String projectTitle, String reviewNotes,
                                     String dashboardUrl) {
        raw.sendProjectReturned(email, internName, projectTitle, reviewNotes, dashboardUrl);
    }

    @Override
    public void sendProjectCompleted(String email, String internName, String projectTitle, String dashboardUrl) {
        raw.sendProjectCompleted(email, internName, projectTitle, dashboardUrl);
    }

    @Override
    public void sendEvaluationDue(String supervisorEmail, String supervisorName, String internName,
                                   String evaluationType, Integer daysInDraft, String supervisorDashboardUrl) {
        raw.sendEvaluationDue(supervisorEmail, supervisorName, internName, evaluationType, daysInDraft,
                supervisorDashboardUrl);
    }

    @Override
    public void sendEvaluationFinalized(String email, String internName, String evaluationType,
                                         String supervisorName, Integer overallRating, String dashboardUrl) {
        raw.sendEvaluationFinalized(email, internName, evaluationType, supervisorName, overallRating, dashboardUrl);
    }

    @Override
    public void sendI983SelfEvalDue(String email, String internName, String evaluationType, String dashboardUrl) {
        raw.sendI983SelfEvalDue(email, internName, evaluationType, dashboardUrl);
    }

    @Override
    public void sendProjectTechApproved(String email, String internName, String projectTitle, String dashboardUrl) {
        raw.sendProjectTechApproved(email, internName, projectTitle, dashboardUrl);
    }

    @Override
    public void sendProjectReturnedForRevisions(String email, String internName, String projectTitle,
                                                 String reason, String dashboardUrl) {
        raw.sendProjectReturnedForRevisions(email, internName, projectTitle, reason, dashboardUrl);
    }

    @Override
    public void sendProjectPendingViva(String email, String internName, String projectTitle, String dashboardUrl) {
        raw.sendProjectPendingViva(email, internName, projectTitle, dashboardUrl);
    }
}
