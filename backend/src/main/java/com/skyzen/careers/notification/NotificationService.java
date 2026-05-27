package com.skyzen.careers.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.EVerifyCase;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.I9Form;
import com.skyzen.careers.entity.I983Plan;
import com.skyzen.careers.entity.Interview;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.OnboardingTask;
import com.skyzen.careers.entity.SentNotification;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.SentNotificationRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Orchestrator for batch-1 applicant-lifecycle notifications.
 *
 * <h2>Responsibilities</h2>
 * <ol>
 *   <li><b>Idempotency</b> — checks {@link SentNotificationRepository} before
 *       every send; a duplicate {@code (event, target)} silently no-ops. This
 *       absorbs status flip-flops (e.g. Shortlisted → Applied → Shortlisted
 *       only emails once).</li>
 *   <li><b>Audit</b> — writes one {@code NOTIFICATION_SENT} {@link AuditLog}
 *       row per real send with the event type, target id, and recipient
 *       captured in {@code afterJson}.</li>
 *   <li><b>Failure containment</b> — every send is wrapped in try/catch.
 *       Email failures are logged and swallowed; the caller's domain action
 *       (offer sent, application created, etc.) always succeeds.</li>
 * </ol>
 *
 * <h2>Transactional posture</h2>
 * Each {@code sendX(...)} call runs in {@link Propagation#REQUIRES_NEW} so the
 * notification ledger commit (idempotency row + audit row) survives even when
 * the caller's outer transaction rolls back. Conversely, a notification-side
 * write failure CANNOT roll back the caller's domain change.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final EmailProvider emailProvider;
    private final SentNotificationRepository sentNotificationRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;

    /**
     * Operations recipient for "offer accepted" notifications. Configure as a
     * shared distribution list / shared inbox. Empty/blank disables the ops
     * notification (a warning is logged once per send-attempt so misconfig is
     * visible).
     */
    @Value("${app.ops.notification-email:}")
    private String opsNotificationEmail;

    /** Public URL of the candidate dashboard, used in the onboarding welcome. */
    @Value("${app.onboarding.dashboard-url:https://www.skyzentech.com/careers/candidate}")
    private String dashboardUrl;

    /** HR dashboard URL surfaced in batch-2 HR-targeted emails (I-9 §2, I-983 ready). */
    @Value("${app.hr.dashboard-url:https://www.skyzentech.com/careers/hr}")
    private String hrDashboardUrl;

    /**
     * Template for the offer "view" URL embedded in the offer-extended email.
     * {@code {id}} is replaced with the offer's UUID.
     */
    @Value("${app.offer.view-url-template:https://www.skyzentech.com/careers/candidate/offers/{id}}")
    private String offerViewUrlTemplate;

    // ── Public API (per-event-type) ─────────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendApplicationReceived(Application application) {
        if (application == null) return;
        UUID targetId = application.getId();
        String email = candidateEmail(application);
        String name = candidateName(application);
        if (email == null) {
            log.warn("APPLICATION_RECEIVED skipped — no candidate email on application {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.APPLICATION_RECEIVED, targetId)) return;

        String jobTitle = jobTitle(application);
        String entityName = entityName(application);
        deliver(NotificationEventType.APPLICATION_RECEIVED, targetId, email,
                () -> emailProvider.sendApplicationReceived(email, name, jobTitle, entityName));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendApplicationShortlisted(Application application) {
        if (application == null) return;
        UUID targetId = application.getId();
        String email = candidateEmail(application);
        String name = candidateName(application);
        if (email == null) {
            log.warn("APPLICATION_SHORTLISTED skipped — no candidate email on application {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.APPLICATION_SHORTLISTED, targetId)) return;

        String jobTitle = jobTitle(application);
        String entityName = entityName(application);
        deliver(NotificationEventType.APPLICATION_SHORTLISTED, targetId, email,
                () -> emailProvider.sendApplicationShortlisted(email, name, jobTitle, entityName));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendApplicationRejected(Application application) {
        if (application == null) return;
        UUID targetId = application.getId();
        String email = candidateEmail(application);
        String name = candidateName(application);
        if (email == null) {
            log.warn("APPLICATION_REJECTED skipped — no candidate email on application {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.APPLICATION_REJECTED, targetId)) return;

        String jobTitle = jobTitle(application);
        String entityName = entityName(application);
        deliver(NotificationEventType.APPLICATION_REJECTED, targetId, email,
                () -> emailProvider.sendApplicationRejected(email, name, jobTitle, entityName));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendInterviewScheduled(Interview interview) {
        if (interview == null) return;
        UUID targetId = interview.getId();
        Application application = interview.getApplication();
        String email = candidateEmail(application);
        String name = candidateName(application);
        if (email == null) {
            log.warn("INTERVIEW_SCHEDULED skipped — no candidate email on interview {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.INTERVIEW_SCHEDULED, targetId)) return;

        String jobTitle = jobTitle(application);
        String entityName = entityName(application);
        String interviewType = interview.getType() != null ? interview.getType().name() : null;
        String interviewerName = interview.getInterviewer() != null
                ? interview.getInterviewer().getFullName() : null;
        deliver(NotificationEventType.INTERVIEW_SCHEDULED, targetId, email,
                () -> emailProvider.sendInterviewScheduled(
                        email, name, jobTitle, entityName,
                        interview.getScheduledAt(), interview.getDurationMinutes(),
                        interviewType, interviewerName,
                        interview.getMeetingUrl(), interview.getCandidateNotes()));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendInterviewReminder(Interview interview) {
        if (interview == null) return;
        UUID targetId = interview.getId();
        Application application = interview.getApplication();
        String email = candidateEmail(application);
        String name = candidateName(application);
        if (email == null) {
            log.warn("INTERVIEW_REMINDER skipped — no candidate email on interview {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.INTERVIEW_REMINDER, targetId)) return;

        String jobTitle = jobTitle(application);
        String entityName = entityName(application);
        String interviewType = interview.getType() != null ? interview.getType().name() : null;
        String interviewerName = interview.getInterviewer() != null
                ? interview.getInterviewer().getFullName() : null;
        deliver(NotificationEventType.INTERVIEW_REMINDER, targetId, email,
                () -> emailProvider.sendInterviewReminder(
                        email, name, jobTitle, entityName,
                        interview.getScheduledAt(), interview.getDurationMinutes(),
                        interviewType, interviewerName,
                        interview.getMeetingUrl()));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendOfferExtended(Offer offer) {
        if (offer == null) return;
        UUID targetId = offer.getId();
        Application application = offer.getApplication();
        String email = candidateEmail(application);
        String name = candidateName(application);
        if (email == null) {
            log.warn("OFFER_EXTENDED skipped — no candidate email on offer {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.OFFER_EXTENDED, targetId)) return;

        String jobTitle = jobTitle(application);
        String entityName = entityName(application);
        String currency = offer.getCompensationCurrency();
        String frequency = offer.getCompensationFrequency() != null
                ? offer.getCompensationFrequency().name() : null;
        String viewUrl = offerViewUrlTemplate.replace("{id}", offer.getId().toString());
        deliver(NotificationEventType.OFFER_EXTENDED, targetId, email,
                () -> emailProvider.sendOfferExtended(
                        email, name, jobTitle, entityName,
                        offer.getCompensationAmount(), currency, frequency,
                        offer.getStartDate(), offer.getExpiresAt(), viewUrl));
    }

    /** Fires BOTH sends — applicant confirmation + ops heads-up. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendOfferAccepted(Offer offer) {
        if (offer == null) return;
        UUID targetId = offer.getId();
        Application application = offer.getApplication();
        String email = candidateEmail(application);
        String name = candidateName(application);
        String jobTitle = jobTitle(application);
        String entityName = entityName(application);

        // 1) Applicant confirmation.
        if (email != null) {
            if (!alreadySent(NotificationEventType.OFFER_ACCEPTED, targetId)) {
                deliver(NotificationEventType.OFFER_ACCEPTED, targetId, email,
                        () -> emailProvider.sendOfferAccepted(
                                email, name, jobTitle, entityName, offer.getStartDate()));
            }
        } else {
            log.warn("OFFER_ACCEPTED (applicant) skipped — no candidate email on offer {}", targetId);
        }

        // 2) Operations heads-up.
        if (opsNotificationEmail == null || opsNotificationEmail.isBlank()) {
            log.warn("OFFER_ACCEPTED_OPS skipped — app.ops.notification-email is not configured "
                    + "(offer {}). Set OPS_NOTIFICATION_EMAIL to enable.", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.OFFER_ACCEPTED_OPS, targetId)) return;
        deliver(NotificationEventType.OFFER_ACCEPTED_OPS, targetId, opsNotificationEmail,
                () -> emailProvider.sendOfferAcceptedToOps(
                        opsNotificationEmail, name, email, jobTitle, entityName,
                        offer.getStartDate()));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendOnboardingWelcome(Engagement engagement) {
        if (engagement == null) return;
        UUID targetId = engagement.getId();
        Application application = engagement.getApplication();
        String email = candidateEmail(application);
        String name = candidateName(application);
        if (email == null) {
            log.warn("ONBOARDING_WELCOME skipped — no candidate email on engagement {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.ONBOARDING_WELCOME, targetId)) return;

        String jobTitle = jobTitle(application);
        StaffingEntity ent = engagement.getEntity();
        String entityName = ent != null ? ent.getName() : entityName(application);
        deliver(NotificationEventType.ONBOARDING_WELCOME, targetId, email,
                () -> emailProvider.sendOnboardingWelcome(
                        email, name, jobTitle, entityName,
                        engagement.getActualStartDate(), dashboardUrl));
    }

    // ── Batch 2 — compliance / onboarding ───────────────────────────────────
    // PII RULE: callers pass only the entity reference. The send-fns here pull
    // ONLY name + status + dates + URLs from the entity — never SSN, document
    // numbers, addresses, or any decrypted PII. See SmtpEmailProvider templates.

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendI9Section1Reminder(I9Form form) {
        if (form == null) return;
        UUID targetId = form.getId();
        String email = candidateEmailFromForm(form);
        String name = candidateNameFromForm(form);
        if (email == null) {
            log.warn("I9_SECTION1_REMINDER skipped — no candidate email on i9-form {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.I9_SECTION1_REMINDER, targetId)) return;

        deliver(NotificationEventType.I9_SECTION1_REMINDER, targetId, email,
                () -> emailProvider.sendI9Section1Reminder(
                        email, name, form.getSection1DueDate(), dashboardUrl));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendI9Section2Pending(I9Form form) {
        if (form == null) return;
        UUID targetId = form.getId();
        if (alreadySent(NotificationEventType.I9_SECTION2_PENDING, targetId)) return;

        String internName = candidateNameFromForm(form);
        List<String> hrRecipients = hrComplianceEmails();
        if (hrRecipients.isEmpty()) {
            log.warn("I9_SECTION2_PENDING skipped — no HR_COMPLIANCE users to notify "
                    + "(form {}). Add a user with HR_COMPLIANCE role.", targetId);
            return;
        }
        // Single ledger row keyed on the form; the email goes to all HR users
        // via the To: list so we don't fan-out per recipient.
        String to = String.join(", ", hrRecipients);
        deliver(NotificationEventType.I9_SECTION2_PENDING, targetId, to,
                () -> emailProvider.sendI9Section2Pending(
                        to, internName, form.getSection2DueDate(), hrDashboardUrl));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendI983PlanNeeded(Engagement engagement) {
        if (engagement == null) return;
        UUID targetId = engagement.getId();
        Application application = engagement.getApplication();
        String email = candidateEmail(application);
        String name = candidateName(application);
        if (email == null) {
            log.warn("I983_PLAN_NEEDED skipped — no candidate email on engagement {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.I983_PLAN_NEEDED, targetId)) return;

        deliver(NotificationEventType.I983_PLAN_NEEDED, targetId, email,
                () -> emailProvider.sendI983PlanNeeded(email, name, dashboardUrl));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendI983PlanReady(I983Plan plan) {
        if (plan == null) return;
        UUID targetId = plan.getId();
        if (alreadySent(NotificationEventType.I983_PLAN_READY, targetId)) return;

        Candidate c = plan.getCandidate();
        User u = c != null ? c.getUser() : null;
        String internName = u != null ? u.getFullName() : null;

        List<String> hrRecipients = hrComplianceEmails();
        if (hrRecipients.isEmpty()) {
            log.warn("I983_PLAN_READY skipped — no HR_COMPLIANCE users (plan {})", targetId);
            return;
        }
        String to = String.join(", ", hrRecipients);
        deliver(NotificationEventType.I983_PLAN_READY, targetId, to,
                () -> emailProvider.sendI983PlanReady(to, internName, hrDashboardUrl));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendEVerifyCaseOpened(EVerifyCase ev) {
        if (ev == null) return;
        UUID targetId = ev.getId();
        I9Form form = ev.getI9Form();
        String email = candidateEmailFromForm(form);
        String name = candidateNameFromForm(form);
        if (email == null) {
            log.warn("EVERIFY_CASE_OPENED skipped — no candidate email on case {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.EVERIFY_CASE_OPENED, targetId)) return;

        deliver(NotificationEventType.EVERIFY_CASE_OPENED, targetId, email,
                () -> emailProvider.sendEVerifyCaseOpened(email, name, dashboardUrl));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendEVerifyTncAlert(EVerifyCase ev) {
        if (ev == null) return;
        UUID targetId = ev.getId();
        I9Form form = ev.getI9Form();
        String email = candidateEmailFromForm(form);
        String name = candidateNameFromForm(form);
        if (email == null) {
            log.warn("EVERIFY_TNC_ALERT skipped — no candidate email on case {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.EVERIFY_TNC_ALERT, targetId)) return;

        deliver(NotificationEventType.EVERIFY_TNC_ALERT, targetId, email,
                () -> emailProvider.sendEVerifyTncAlert(email, name, dashboardUrl));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendEVerifyCleared(EVerifyCase ev) {
        if (ev == null) return;
        UUID targetId = ev.getId();
        I9Form form = ev.getI9Form();
        String email = candidateEmailFromForm(form);
        String name = candidateNameFromForm(form);
        if (email == null) {
            log.warn("EVERIFY_CLEARED skipped — no candidate email on case {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.EVERIFY_CLEARED, targetId)) return;

        deliver(NotificationEventType.EVERIFY_CLEARED, targetId, email,
                () -> emailProvider.sendEVerifyCleared(email, name, dashboardUrl));
    }

    /**
     * Work-auth expiry reminder. One event type per threshold, target_id =
     * engagement_id, so each engagement gets at most one email per threshold
     * (90/60/30/14/7). Scheduler decides which threshold to fire.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendWorkAuthExpiryReminder(Engagement engagement, int daysUntilExpiry,
                                           LocalDate expirationDate, String authType) {
        if (engagement == null) return;
        NotificationEventType eventType = workAuthEventForThreshold(daysUntilExpiry);
        if (eventType == null) return; // not a configured threshold
        UUID targetId = engagement.getId();
        Application application = engagement.getApplication();
        String email = candidateEmail(application);
        String name = candidateName(application);
        if (email == null) {
            log.warn("{} skipped — no candidate email on engagement {}", eventType, targetId);
            return;
        }
        if (alreadySent(eventType, targetId)) return;

        deliver(eventType, targetId, email,
                () -> emailProvider.sendWorkAuthExpiryReminder(
                        email, name, daysUntilExpiry, expirationDate, authType, dashboardUrl));
    }

    /**
     * Generic compliance-task reminder. target_id = task_id so each overdue
     * task gets exactly one reminder ever (re-running the scheduler on the
     * same overdue task is a no-op).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendComplianceTaskReminder(OnboardingTask task) {
        if (task == null) return;
        UUID targetId = task.getId();
        Candidate c = task.getCandidate();
        User u = c != null ? c.getUser() : null;
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) {
            log.warn("COMPLIANCE_TASK_REMINDER skipped — no candidate email on task {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.COMPLIANCE_TASK_REMINDER, targetId)) return;

        Integer overdue = null;
        if (task.getDueDate() != null) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(
                    task.getDueDate(), LocalDate.now());
            overdue = days > 0 ? (int) days : 0;
        }
        final Integer overdueFinal = overdue;
        deliver(NotificationEventType.COMPLIANCE_TASK_REMINDER, targetId, email,
                () -> emailProvider.sendComplianceTaskReminder(
                        email, name, task.getTitle(), task.getDueDate(),
                        overdueFinal, dashboardUrl));
    }

    /** Public so the WorkAuthExpiryScheduler can pick the right threshold. */
    public static NotificationEventType workAuthEventForThreshold(int days) {
        return switch (days) {
            case 90 -> NotificationEventType.WORKAUTH_EXPIRY_90;
            case 60 -> NotificationEventType.WORKAUTH_EXPIRY_60;
            case 30 -> NotificationEventType.WORKAUTH_EXPIRY_30;
            case 14 -> NotificationEventType.WORKAUTH_EXPIRY_14;
            case 7  -> NotificationEventType.WORKAUTH_EXPIRY_7;
            default -> null;
        };
    }

    // ── Internal plumbing ──────────────────────────────────────────────────

    private boolean alreadySent(NotificationEventType eventType, UUID targetId) {
        try {
            return sentNotificationRepository.existsByEventTypeAndTargetId(eventType, targetId);
        } catch (Exception e) {
            log.warn("Idempotency check failed for {}/{} — proceeding with send: {}",
                    eventType, targetId, e.getMessage());
            return false;
        }
    }

    /**
     * Execute the send, persist the idempotency row, write the audit row. All
     * failures are caught + logged; the caller's domain action is never
     * affected.
     */
    private void deliver(NotificationEventType eventType, UUID targetId, String recipient,
                         Runnable sendFn) {
        try {
            sendFn.run();
        } catch (Exception e) {
            log.warn("Notification {} for {} ({}) failed (non-fatal): {}",
                    eventType, targetId, recipient, e.getMessage());
            return;
        }

        // Best-effort ledger + audit. A race that double-sends still only
        // commits one ledger row (the unique constraint protects); the second
        // commit attempt is logged and swallowed.
        try {
            sentNotificationRepository.save(SentNotification.builder()
                    .eventType(eventType)
                    .targetId(targetId)
                    .recipient(recipient)
                    .build());
        } catch (DataIntegrityViolationException dive) {
            log.info("Duplicate notification ledger row for {}/{} — already recorded.",
                    eventType, targetId);
        } catch (Exception e) {
            log.warn("Failed to persist sent_notifications row for {}/{} (non-fatal): {}",
                    eventType, targetId, e.getMessage());
        }

        try {
            Map<String, Object> after = new LinkedHashMap<>();
            after.put("eventType", eventType.name());
            after.put("targetId", targetId.toString());
            after.put("recipient", recipient);
            AuditLog entry = AuditLog.builder()
                    .entityType("Notification")
                    .entityId(targetId)
                    .action("NOTIFICATION_SENT")
                    .afterJson(objectMapper.writeValueAsString(after))
                    .build();
            auditLogRepository.save(entry);
        } catch (JsonProcessingException jpe) {
            log.warn("Failed to serialize NOTIFICATION_SENT audit for {}/{}: {}",
                    eventType, targetId, jpe.getMessage());
        } catch (Exception e) {
            log.warn("Failed to write NOTIFICATION_SENT audit row for {}/{} (non-fatal): {}",
                    eventType, targetId, e.getMessage());
        }
    }

    // ── Resolvers (null-tolerant) ──────────────────────────────────────────

    private static String candidateEmail(Application application) {
        if (application == null) return null;
        Candidate c = application.getCandidate();
        if (c == null) return null;
        User u = c.getUser();
        return u != null ? u.getEmail() : null;
    }

    private static String candidateName(Application application) {
        if (application == null) return null;
        Candidate c = application.getCandidate();
        if (c == null) return null;
        User u = c.getUser();
        return u != null ? u.getFullName() : null;
    }

    private static String jobTitle(Application application) {
        if (application == null) return null;
        JobPosting jp = application.getJobPosting();
        return jp != null ? jp.getTitle() : null;
    }

    private static String entityName(Application application) {
        if (application == null) return null;
        JobPosting jp = application.getJobPosting();
        if (jp == null) return null;
        StaffingEntity ent = jp.getEntity();
        return ent != null ? ent.getName() : null;
    }

    private static String candidateEmailFromForm(I9Form form) {
        if (form == null) return null;
        Candidate c = form.getCandidate();
        if (c == null) return null;
        User u = c.getUser();
        return u != null ? u.getEmail() : null;
    }

    private static String candidateNameFromForm(I9Form form) {
        if (form == null) return null;
        Candidate c = form.getCandidate();
        if (c == null) return null;
        User u = c.getUser();
        return u != null ? u.getFullName() : null;
    }

    /**
     * Active recipients with the HR_COMPLIANCE role. Used for the HR-targeted
     * batch-2 sends (I-9 §2 pending, I-983 ready). Filters out blanks/null
     * emails so a misconfigured user doesn't break the send.
     */
    private List<String> hrComplianceEmails() {
        try {
            return userRepository.findByRole(UserRole.HR_COMPLIANCE).stream()
                    .filter(u -> u != null && Boolean.TRUE.equals(u.getActive()))
                    .map(User::getEmail)
                    .filter(e -> e != null && !e.isBlank())
                    .distinct()
                    .toList();
        } catch (Exception e) {
            log.warn("HR recipient lookup failed (non-fatal): {}", e.getMessage());
            return List.of();
        }
    }
}
