package com.skyzen.careers.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.EVerifyCase;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Evaluation;
import com.skyzen.careers.entity.I9Form;
import com.skyzen.careers.entity.I983Plan;
import com.skyzen.careers.entity.Interview;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.OnboardingTask;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.SentNotification;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.entity.WeeklyMaterial;
import com.skyzen.careers.entity.WeeklyReport;
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

import java.nio.charset.StandardCharsets;
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

    /** Supervisor dashboard URL surfaced in batch-3 supervisor-targeted emails. */
    @Value("${app.supervisor.dashboard-url:https://www.skyzentech.com/careers/evaluator}")
    private String supervisorDashboardUrl;

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

    // ── Batch 3 — intern weekly cycle ───────────────────────────────────────

    /**
     * Material released — one email per (material × intern). Broadcast
     * materials fan out across all ACTIVE engagements; scoped materials
     * email just the targeted engagement's intern. Caller supplies the list
     * of recipient candidates so this method stays storage-shape-agnostic.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendWeeklyMaterialReleased(WeeklyMaterial material, Candidate intern) {
        if (material == null || intern == null) return;
        User u = intern.getUser();
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) return;

        UUID targetId = weeklyTargetId("MATERIAL_RELEASED",
                material.getId().toString(), intern.getId().toString());
        if (alreadySent(NotificationEventType.WEEKLY_MATERIAL_RELEASED, targetId)) return;

        deliver(NotificationEventType.WEEKLY_MATERIAL_RELEASED, targetId, email,
                () -> emailProvider.sendWeeklyMaterialReleased(
                        email, name, material.getWeekNo(), material.getTitle(),
                        dashboardUrl));
    }

    /** Material still unread — fired by the daily scheduler. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendMaterialUnreadReminder(WeeklyMaterial material, Candidate intern) {
        if (material == null || intern == null) return;
        User u = intern.getUser();
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) return;

        UUID targetId = weeklyTargetId("MATERIAL_UNREAD",
                material.getId().toString(), intern.getId().toString());
        if (alreadySent(NotificationEventType.MATERIAL_UNREAD_REMINDER, targetId)) return;

        deliver(NotificationEventType.MATERIAL_UNREAD_REMINDER, targetId, email,
                () -> emailProvider.sendMaterialUnreadReminder(
                        email, name, material.getWeekNo(), material.getTitle(),
                        dashboardUrl));
    }

    /** Weekly report due — fired by the daily scheduler late in the week. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendWeeklyReportDue(Engagement engagement, LocalDate weekStart) {
        if (engagement == null || weekStart == null) return;
        Candidate c = engagement.getCandidate();
        User u = c != null ? c.getUser() : null;
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) return;

        UUID targetId = weeklyTargetId("REPORT_DUE",
                engagement.getId().toString(), weekStart.toString());
        if (alreadySent(NotificationEventType.WEEKLY_REPORT_DUE, targetId)) return;

        deliver(NotificationEventType.WEEKLY_REPORT_DUE, targetId, email,
                () -> emailProvider.sendWeeklyReportDue(email, name, weekStart, dashboardUrl));
    }

    /** Weekly report returned for changes — event-triggered. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendWeeklyReportReturned(WeeklyReport report) {
        if (report == null) return;
        UUID targetId = report.getId();
        Candidate c = report.getIntern();
        User u = c != null ? c.getUser() : null;
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) {
            log.warn("WEEKLY_REPORT_RETURNED skipped — no candidate email on report {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.WEEKLY_REPORT_RETURNED, targetId)) return;

        deliver(NotificationEventType.WEEKLY_REPORT_RETURNED, targetId, email,
                () -> emailProvider.sendWeeklyReportReturned(
                        email, name, report.getWeekStart(),
                        report.getReviewNotes(), dashboardUrl));
    }

    /** Weekly report approved — event-triggered. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendWeeklyReportApproved(WeeklyReport report) {
        if (report == null) return;
        UUID targetId = report.getId();
        Candidate c = report.getIntern();
        User u = c != null ? c.getUser() : null;
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) return;
        if (alreadySent(NotificationEventType.WEEKLY_REPORT_APPROVED, targetId)) return;

        deliver(NotificationEventType.WEEKLY_REPORT_APPROVED, targetId, email,
                () -> emailProvider.sendWeeklyReportApproved(
                        email, name, report.getWeekStart(), dashboardUrl));
    }

    /** Timesheet due — fired by the daily scheduler. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendTimesheetDue(Engagement engagement, LocalDate weekStart) {
        if (engagement == null || weekStart == null) return;
        Candidate c = engagement.getCandidate();
        User u = c != null ? c.getUser() : null;
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) return;

        UUID targetId = weeklyTargetId("TIMESHEET_DUE",
                engagement.getId().toString(), weekStart.toString());
        if (alreadySent(NotificationEventType.TIMESHEET_DUE, targetId)) return;

        deliver(NotificationEventType.TIMESHEET_DUE, targetId, email,
                () -> emailProvider.sendTimesheetDue(email, name, weekStart, dashboardUrl));
    }

    /** Project assigned — event-triggered, intern recipient. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendProjectAssigned(Project project) {
        if (project == null) return;
        UUID targetId = project.getId();
        Candidate intern = project.getIntern();
        User u = intern != null ? intern.getUser() : null;
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) {
            log.warn("PROJECT_ASSIGNED skipped — no candidate email on project {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.PROJECT_ASSIGNED, targetId)) return;

        User assignedBy = project.getAssignedBy();
        String by = assignedBy != null ? assignedBy.getFullName() : null;
        deliver(NotificationEventType.PROJECT_ASSIGNED, targetId, email,
                () -> emailProvider.sendProjectAssigned(
                        email, name, project.getTitle(), project.getDueDate(),
                        by, dashboardUrl));
    }

    /** Project submitted — event-triggered, supervisor recipient. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendProjectSubmitted(Project project) {
        if (project == null) return;
        UUID targetId = project.getId();
        Engagement eng = project.getEngagement();
        User supervisor = eng != null ? eng.getSupervisor() : null;
        // Fallback to whoever assigned it if engagement.supervisor is null.
        if (supervisor == null) supervisor = project.getAssignedBy();
        String email = supervisor != null ? supervisor.getEmail() : null;
        String name = supervisor != null ? supervisor.getFullName() : null;
        if (email == null) {
            log.warn("PROJECT_SUBMITTED skipped — no supervisor email on project {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.PROJECT_SUBMITTED, targetId)) return;

        Candidate intern = project.getIntern();
        User iu = intern != null ? intern.getUser() : null;
        String internName = iu != null ? iu.getFullName() : null;
        final String supervisorEmail = email;
        final String supervisorName = name;
        deliver(NotificationEventType.PROJECT_SUBMITTED, targetId, supervisorEmail,
                () -> emailProvider.sendProjectSubmitted(
                        supervisorEmail, supervisorName, internName,
                        project.getTitle(), supervisorDashboardUrl));
    }

    /** Project returned for changes — event-triggered, intern recipient. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendProjectReturned(Project project) {
        if (project == null) return;
        UUID targetId = project.getId();
        Candidate intern = project.getIntern();
        User u = intern != null ? intern.getUser() : null;
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) return;
        if (alreadySent(NotificationEventType.PROJECT_RETURNED, targetId)) return;

        deliver(NotificationEventType.PROJECT_RETURNED, targetId, email,
                () -> emailProvider.sendProjectReturned(
                        email, name, project.getTitle(),
                        project.getReviewNotes(), dashboardUrl));
    }

    /** Project completed — event-triggered, intern recipient. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendProjectCompleted(Project project) {
        if (project == null) return;
        UUID targetId = project.getId();
        Candidate intern = project.getIntern();
        User u = intern != null ? intern.getUser() : null;
        String email = u != null ? u.getEmail() : null;
        String name = u != null ? u.getFullName() : null;
        if (email == null) return;
        if (alreadySent(NotificationEventType.PROJECT_COMPLETED, targetId)) return;

        deliver(NotificationEventType.PROJECT_COMPLETED, targetId, email,
                () -> emailProvider.sendProjectCompleted(
                        email, name, project.getTitle(), dashboardUrl));
    }

    /** Evaluation due — fired by the daily scheduler against DRAFT older than N days. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendEvaluationDue(Evaluation evaluation, int daysInDraft) {
        if (evaluation == null) return;
        UUID targetId = evaluation.getId();
        User supervisor = evaluation.getEvaluator();
        String email = supervisor != null ? supervisor.getEmail() : null;
        String name = supervisor != null ? supervisor.getFullName() : null;
        if (email == null) {
            log.warn("EVALUATION_DUE skipped — no evaluator email on evaluation {}", targetId);
            return;
        }
        if (alreadySent(NotificationEventType.EVALUATION_DUE, targetId)) return;

        Candidate intern = evaluation.getIntern();
        User iu = intern != null ? intern.getUser() : null;
        String internName = iu != null ? iu.getFullName() : null;
        String type = evaluation.getType() != null ? evaluation.getType().name() : null;
        final String supervisorEmail = email;
        final String supervisorName = name;
        deliver(NotificationEventType.EVALUATION_DUE, targetId, supervisorEmail,
                () -> emailProvider.sendEvaluationDue(
                        supervisorEmail, supervisorName, internName, type,
                        daysInDraft, supervisorDashboardUrl));
    }

    /** Evaluation finalized — event-triggered, intern recipient. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendEvaluationFinalized(Evaluation evaluation) {
        if (evaluation == null) return;
        UUID targetId = evaluation.getId();
        Candidate intern = evaluation.getIntern();
        User iu = intern != null ? intern.getUser() : null;
        String email = iu != null ? iu.getEmail() : null;
        String name = iu != null ? iu.getFullName() : null;
        if (email == null) return;
        if (alreadySent(NotificationEventType.EVALUATION_FINALIZED, targetId)) return;

        User supervisor = evaluation.getEvaluator();
        String supervisorName = supervisor != null ? supervisor.getFullName() : null;
        String type = evaluation.getType() != null ? evaluation.getType().name() : null;
        deliver(NotificationEventType.EVALUATION_FINALIZED, targetId, email,
                () -> emailProvider.sendEvaluationFinalized(
                        email, name, type, supervisorName,
                        evaluation.getOverallRating(), dashboardUrl));
    }

    /** I-983 self-review due — fired by the daily scheduler. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendI983SelfEvalDue(Evaluation evaluation) {
        if (evaluation == null) return;
        UUID targetId = evaluation.getId();
        Candidate intern = evaluation.getIntern();
        User iu = intern != null ? intern.getUser() : null;
        String email = iu != null ? iu.getEmail() : null;
        String name = iu != null ? iu.getFullName() : null;
        if (email == null) return;
        if (alreadySent(NotificationEventType.I983_SELF_EVAL_DUE, targetId)) return;

        String type = evaluation.getType() != null ? evaluation.getType().name() : null;
        deliver(NotificationEventType.I983_SELF_EVAL_DUE, targetId, email,
                () -> emailProvider.sendI983SelfEvalDue(email, name, type, dashboardUrl));
    }

    /**
     * Build a deterministic UUID for "weekly" idempotency keys. The
     * sent_notifications table is keyed on (event_type, target_id) — for
     * events that fire once per (resource × recipient × period) we need a
     * synthetic target_id that encodes all three. UUIDv3 over a salted name
     * gives us a stable hash that survives restarts and runs deterministic
     * across the cluster.
     */
    public static UUID weeklyTargetId(String namespace, String... parts) {
        StringBuilder sb = new StringBuilder(namespace);
        for (String p : parts) {
            sb.append(':').append(p == null ? "" : p);
        }
        return UUID.nameUUIDFromBytes(sb.toString().getBytes(StandardCharsets.UTF_8));
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
        // Opt-out gate. Transactional events are always sent. For
        // reminders + engagement-updates, look up the recipient user and skip
        // if their preference flag is off. We can't resolve a user for blasts
        // sent to a comma-joined HR/Ops list — those proceed unconditionally,
        // which is correct: those are staff workflows, not user-personalised
        // streams.
        NotificationCategory category = NotificationEventCategories.categoryOf(eventType);
        if (category != NotificationCategory.TRANSACTIONAL && recipient != null
                && !recipient.contains(",")) {
            User recipientUser = userRepository.findByEmail(recipient.trim()).orElse(null);
            if (recipientUser != null && isOptedOut(recipientUser, category)) {
                log.info("Skipping {} for {} — user opted out of {}",
                        eventType, recipient, category);
                writeOptOutAudit(eventType, targetId, recipient, category);
                return;
            }
        }

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
     * Has the recipient turned off this category? Defaults to FALSE (opt-in
     * is the default) — null flag on a legacy User row means "not opted out".
     */
    private static boolean isOptedOut(User user, NotificationCategory category) {
        if (user == null || category == null) return false;
        return switch (category) {
            case REMINDERS -> Boolean.FALSE.equals(user.getPrefsReminders());
            case ENGAGEMENT_UPDATES -> Boolean.FALSE.equals(user.getPrefsEngagementUpdates());
            case TRANSACTIONAL -> false; // never opt-outable
        };
    }

    /**
     * Audit a suppression so the operator can see the user's intent reflected
     * in the same audit stream as real sends. {@code action=NOTIFICATION_SKIPPED}
     * lives alongside {@code NOTIFICATION_SENT} for a clean ledger.
     */
    private void writeOptOutAudit(NotificationEventType eventType, UUID targetId,
                                  String recipient, NotificationCategory category) {
        try {
            Map<String, Object> after = new LinkedHashMap<>();
            after.put("eventType", eventType.name());
            after.put("targetId", targetId != null ? targetId.toString() : null);
            after.put("recipient", recipient);
            after.put("reason", "opted_out");
            after.put("category", category.name());
            AuditLog entry = AuditLog.builder()
                    .entityType("Notification")
                    .entityId(targetId)
                    .action("NOTIFICATION_SKIPPED")
                    .afterJson(objectMapper.writeValueAsString(after))
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("Failed to write NOTIFICATION_SKIPPED audit (non-fatal): {}",
                    e.getMessage());
        }
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
