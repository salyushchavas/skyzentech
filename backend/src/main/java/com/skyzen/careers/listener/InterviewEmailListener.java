package com.skyzen.careers.listener;

import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.Interview;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.erm.CommunicationTemplateService;
import com.skyzen.careers.erm.ReasonCode;
import com.skyzen.careers.event.InterviewCancelledEvent;
import com.skyzen.careers.event.InterviewCompletedEvent;
import com.skyzen.careers.event.InterviewRescheduledEvent;
import com.skyzen.careers.event.InterviewScheduledEvent;
import com.skyzen.careers.event.ManagerHireDecisionEvent;
import com.skyzen.careers.notification.EmailProvider;
import com.skyzen.careers.notification.MeetingEmailHtmlBuilder;
import com.skyzen.careers.notification.UserNotificationDispatcher;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.InterviewRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * ERM Phase 3 — fans out per-event side effects after AFTER_COMMIT for
 * the 4 interview events: SCHEDULED, RESCHEDULED, CANCELLED, COMPLETED.
 * Completion routes to the matching SELECTED / HOLD / REJECTED template
 * based on the decision recorded on the interview.
 *
 * <p>Hard-coded fallback when template missing — the email path never
 * blocks the decision.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InterviewEmailListener {

    private static final DateTimeFormatter LOCAL_FMT =
            DateTimeFormatter.ofPattern("EEEE, MMM d 'at' h:mm a");

    private final InterviewRepository interviewRepository;
    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final CommunicationTemplateService templateService;
    private final EmailProvider emailProvider;
    private final UserNotificationDispatcher dispatcher;

    // ── SCHEDULED ─────────────────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onScheduled(InterviewScheduledEvent e) {
        if (e == null || e.getInterviewId() == null) return;
        try {
            Interview iv = interviewRepository.findById(e.getInterviewId()).orElse(null);
            if (iv == null) return;
            sendScheduled(iv);
            dispatchManagersOnSchedule(iv);
        } catch (Exception ex) {
            log.warn("[InterviewEmail] scheduled handler failed: {}", ex.getMessage());
        }
    }

    private void sendScheduled(Interview iv) {
        Application app = iv.getApplication();
        User applicant = applicantUser(app);
        if (applicant == null || applicant.getEmail() == null) return;
        Map<String, Object> vars = scheduledVars(iv, app, applicant);
        renderAndSend("INTERVIEW_SCHEDULED", vars, applicant,
                "Your Skyzen interview is scheduled for "
                        + vars.get("scheduledForLocal"),
                "Hello " + vars.get("firstName") + ",\n\n"
                        + "Your interview for " + vars.get("jobTitle")
                        + " is scheduled for " + vars.get("scheduledForLocal")
                        + " " + vars.get("timezone") + ".\n\n"
                        + "Join via: " + vars.get("zoomJoinUrl") + "\n"
                        + "Interviewer: " + vars.get("interviewerName") + "\n\n"
                        + "— Skyzen ERM",
                "INTERVIEW_SCHEDULED",
                "/careers/intern/interviews/" + iv.getId());
    }

    // ── RESCHEDULED ───────────────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRescheduled(InterviewRescheduledEvent e) {
        if (e == null || e.getInterviewId() == null) return;
        try {
            Interview iv = interviewRepository.findById(e.getInterviewId()).orElse(null);
            if (iv == null) return;
            if (e.isNotifyApplicant()) {
                sendRescheduled(iv, e.getReasonCode(), e.getPreviousScheduledAt());
            }
            // Interviewer in-app dispatch (no email).
            if (e.isNotifyInterviewer() && iv.getInterviewer() != null) {
                try {
                    dispatcher.dispatch(iv.getInterviewer().getId(),
                            "INTERVIEW_RESCHEDULED",
                            applicantUserIdOf(iv),
                            "Interview rescheduled",
                            "Updated time: " + LOCAL_FMT.format(
                                    iv.getScheduledAt().atZone(zone(iv.getTimezone()))),
                            "/careers/erm/interviews/" + iv.getId(), false);
                } catch (Exception ex) {
                    log.debug("[InterviewEmail] interviewer dispatch failed: {}", ex.getMessage());
                }
            }
        } catch (Exception ex) {
            log.warn("[InterviewEmail] rescheduled handler failed: {}", ex.getMessage());
        }
    }

    private void sendRescheduled(Interview iv, String reasonCode, java.time.Instant previousAt) {
        Application app = iv.getApplication();
        User applicant = applicantUser(app);
        if (applicant == null || applicant.getEmail() == null) return;
        Map<String, Object> vars = scheduledVars(iv, app, applicant);
        vars.put("newScheduledForLocal", vars.get("scheduledForLocal"));
        vars.put("rescheduleReasonHuman", humanReason(reasonCode));
        renderAndSend("INTERVIEW_RESCHEDULED", vars, applicant,
                "Your Skyzen interview has been rescheduled",
                "Hello " + vars.get("firstName") + ",\n\n"
                        + "Your interview for " + vars.get("jobTitle")
                        + " has been rescheduled to " + vars.get("newScheduledForLocal")
                        + " " + vars.get("timezone") + ".\n\n"
                        + "Reason: " + vars.get("rescheduleReasonHuman") + "\n"
                        + "Updated link: " + vars.get("zoomJoinUrl") + "\n\n"
                        + "— Skyzen ERM",
                "INTERVIEW_RESCHEDULED",
                "/careers/intern/interviews/" + iv.getId());
    }

    // ── CANCELLED ─────────────────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCancelled(InterviewCancelledEvent e) {
        if (e == null || e.getInterviewId() == null) return;
        try {
            Interview iv = interviewRepository.findById(e.getInterviewId()).orElse(null);
            if (iv == null) return;
            if (e.isNotifyApplicant()) {
                sendCancelled(iv, e.getReasonCode(), e.getReasonText());
            }
            // Interviewer in-app notification.
            if (iv.getInterviewer() != null) {
                try {
                    dispatcher.dispatch(iv.getInterviewer().getId(),
                            "INTERVIEW_CANCELLED",
                            applicantUserIdOf(iv),
                            "Interview cancelled",
                            "Reason: " + humanReason(e.getReasonCode()),
                            "/careers/erm/interviews/" + iv.getId(), false);
                } catch (Exception ex) {
                    log.debug("[InterviewEmail] interviewer cancel dispatch failed: {}",
                            ex.getMessage());
                }
            }
        } catch (Exception ex) {
            log.warn("[InterviewEmail] cancelled handler failed: {}", ex.getMessage());
        }
    }

    private void sendCancelled(Interview iv, String reasonCode, String reasonText) {
        Application app = iv.getApplication();
        User applicant = applicantUser(app);
        if (applicant == null || applicant.getEmail() == null) return;
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("firstName", firstName(applicant));
        vars.put("jobTitle", jobTitle(app));
        vars.put("cancellationMessage",
                "Reason: " + humanReason(reasonCode));
        renderAndSend("INTERVIEW_CANCELLED", vars, applicant,
                "Your Skyzen interview has been cancelled",
                "Hello " + vars.get("firstName") + ",\n\n"
                        + "Your interview for " + vars.get("jobTitle")
                        + " has been cancelled.\n\n"
                        + vars.get("cancellationMessage") + "\n\n"
                        + "We will follow up shortly with next steps.\n\n— Skyzen ERM",
                "INTERVIEW_CANCELLED",
                "/careers/intern/interviews");
    }

    // ── COMPLETED ─────────────────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCompleted(InterviewCompletedEvent e) {
        if (e == null || e.getInterviewId() == null) return;
        try {
            Interview iv = interviewRepository.findById(e.getInterviewId()).orElse(null);
            if (iv == null) return;
            // Phase: Manager hire-approval gate. ERM-complete no longer
            // carries a SELECTED/REJECTED decision; the applicant email
            // is now triggered by ManagerHireDecisionEvent. We still
            // fan-out to Managers so they see a new entry to triage.
            dispatchManagersOnComplete(iv);
        } catch (Exception ex) {
            log.warn("[InterviewEmail] completed handler failed: {}", ex.getMessage());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onManagerHireDecision(ManagerHireDecisionEvent e) {
        if (e == null || e.getInterviewId() == null) return;
        try {
            Interview iv = interviewRepository.findById(e.getInterviewId()).orElse(null);
            if (iv == null) return;
            sendDecision(iv);          // applicant outcome email
            notifyErmOfHireDecision(iv, e);   // ERM in-app + email
        } catch (Exception ex) {
            log.warn("[InterviewEmail] manager-hire-decision handler failed: {}",
                    ex.getMessage());
        }
    }

    private void notifyErmOfHireDecision(Interview iv, ManagerHireDecisionEvent e) {
        if (e.getErmUserId() == null) return;
        User erm = userRepository.findById(e.getErmUserId()).orElse(null);
        if (erm == null) return;
        Application app = iv.getApplication();
        User applicant = applicantUser(app);
        String name = applicant != null && applicant.getFullName() != null
                ? applicant.getFullName() : "the candidate";
        String title;
        String body;
        String actionUrl;
        if ("APPROVED".equalsIgnoreCase(e.getDecision())) {
            title = "Hire approved: " + name;
            body = "A Manager approved the hire for " + name
                    + ". The candidate is now SELECTED; once they "
                    + "acknowledge the selection, you can send the offer.";
            actionUrl = "/careers/erm/decision-center";
        } else {
            title = "Hire not approved: " + name;
            body = "A Manager declined the hire for " + name
                    + ". The application has been moved to REJECTED.";
            actionUrl = "/careers/erm/interviews/" + iv.getId();
        }
        try {
            dispatcher.dispatch(erm.getId(), "MANAGER_HIRE_" + e.getDecision(),
                    applicant != null ? applicant.getId() : null,
                    cap(title, 200), cap(body, 400), actionUrl, false);
        } catch (Exception ex) {
            log.debug("[InterviewEmail] ERM in-app dispatch failed: {}", ex.getMessage());
        }
        if (erm.getEmail() != null) {
            try {
                emailProvider.sendRendered(erm.getEmail(), title, body);
            } catch (Exception ex) {
                log.warn("[InterviewEmail] ERM email send failed (non-fatal) for {}: {}",
                        erm.getEmail(), ex.getMessage());
            }
        }
    }

    private void sendDecision(Interview iv) {
        Application app = iv.getApplication();
        User applicant = applicantUser(app);
        if (applicant == null || applicant.getEmail() == null) return;
        String decision = iv.getDecision();
        String templateKey = switch (decision != null ? decision : "") {
            case "SELECTED" -> "INTERVIEW_SELECTED";
            case "HOLD" -> "INTERVIEW_HOLD";
            case "REJECTED" -> "INTERVIEW_REJECTED";
            default -> null;
        };
        if (templateKey == null) return;
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("firstName", firstName(applicant));
        vars.put("jobTitle", jobTitle(app));
        String fallbackSubject = switch (decision) {
            case "SELECTED" -> "Welcome to Skyzen — you've been selected for "
                    + vars.get("jobTitle");
            case "HOLD" -> "Skyzen interview — under consideration";
            default -> "Skyzen interview decision";
        };
        String visibleNotes = iv.getApplicantVisibleNotes() != null
                ? iv.getApplicantVisibleNotes() : "";
        String fallbackBody;
        String actionUrl;
        if ("SELECTED".equals(decision)) {
            // Selection welcome: confirm the position, set expectations,
            // and direct the intern to their dashboard where the
            // "Receive my offer letter" card now appears. The actual
            // offer is issued only after they click it.
            fallbackBody = "Hello " + vars.get("firstName") + ",\n\n"
                    + "Congratulations — you've been selected for the "
                    + vars.get("jobTitle") + " role at Skyzen.\n\n"
                    + (visibleNotes.isEmpty()
                            ? ""
                            : visibleNotes + "\n\n")
                    + "When you're ready to receive your offer letter, "
                    + "sign in to your Skyzen dashboard and click "
                    + "\"Receive my offer letter\". We'll prepare and "
                    + "send your offer right after.\n\n"
                    + "— Skyzen ERM";
            actionUrl = "/careers/intern";
        } else {
            fallbackBody = "Hello " + vars.get("firstName") + ",\n\n"
                    + (visibleNotes.isEmpty()
                            ? "Thank you for interviewing."
                            : visibleNotes)
                    + "\n\n— Skyzen ERM";
            actionUrl = "/careers/intern/applications";
        }
        renderAndSend(templateKey, vars, applicant,
                fallbackSubject, fallbackBody, "INTERVIEW_" + decision,
                actionUrl);
    }

    // ── Shared render+send+dispatch ───────────────────────────────────────

    private void renderAndSend(String templateKey, Map<String, Object> vars,
                                User applicant, String fallbackSubject,
                                String fallbackBody, String eventType,
                                String actionUrl) {
        String subject = fallbackSubject;
        String body = fallbackBody;
        try {
            var rendered = templateService.render(templateKey, "EMAIL", vars).orElse(null);
            if (rendered != null) {
                subject = rendered.subject() != null ? rendered.subject() : fallbackSubject;
                body = rendered.body() != null ? rendered.body() : fallbackBody;
            } else {
                log.info("[InterviewEmail] template {} missing — using hard-coded copy",
                        templateKey);
            }
        } catch (Exception e) {
            log.warn("[InterviewEmail] render failed for {} (non-fatal): {}",
                    templateKey, e.getMessage());
        }
        try {
            // Build an HTML twin with a styled Join button — the join URL
            // (when present in vars) renders as a clickable button in HTML
            // clients + the internal mail viewer. The plain body keeps
            // the URL as text for text-only clients.
            Object joinUrlVar = vars.get("zoomJoinUrl");
            String joinUrl = joinUrlVar == null ? null : joinUrlVar.toString();
            String html = MeetingEmailHtmlBuilder.build(body, joinUrl);
            emailProvider.sendBrandedHtml(applicant.getEmail(), subject, body, html);
        } catch (Exception e) {
            log.warn("[InterviewEmail] email send failed (non-fatal) for {}: {}",
                    applicant.getEmail(), e.getMessage());
        }
        try {
            dispatcher.dispatch(applicant.getId(), eventType,
                    applicant.getId(),
                    cap(subject, 200), cap(body, 400),
                    actionUrl, true);
        } catch (Exception e) {
            log.debug("[InterviewEmail] applicant dispatch failed: {}", e.getMessage());
        }
    }

    private void dispatchManagersOnSchedule(Interview iv) {
        Application app = iv.getApplication();
        User applicant = applicantUser(app);
        if (applicant == null) return;
        try {
            List<User> managers = userRepository.findByRole(UserRole.MANAGER);
            String title = "Interview scheduled: " + applicant.getFullName();
            String body = applicant.getFullName() + " is scheduled to interview for "
                    + jobTitle(app) + ".";
            for (User m : managers) {
                if (m == null || m.getId() == null) continue;
                try {
                    dispatcher.dispatch(m.getId(), "INTERVIEW_SCHEDULED",
                            applicant.getId(),
                            cap(title, 200), cap(body, 400),
                            "/careers/manager", false);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.debug("[InterviewEmail] manager fan-out failed (non-fatal): {}", e.getMessage());
        }
    }

    private void dispatchManagersOnComplete(Interview iv) {
        Application app = iv.getApplication();
        User applicant = applicantUser(app);
        if (applicant == null) return;
        try {
            List<User> managers = userRepository.findByRole(UserRole.MANAGER);
            String title = "Hire approval needed: " + applicant.getFullName();
            String body = "ERM submitted the scorecard for "
                    + applicant.getFullName()
                    + ". Review in the Hire Approvals queue and decide "
                    + "Hire or No-Hire.";
            for (User m : managers) {
                if (m == null || m.getId() == null) continue;
                try {
                    dispatcher.dispatch(m.getId(), "HIRE_APPROVAL_PENDING",
                            applicant.getId(),
                            cap(title, 200), cap(body, 400),
                            "/careers/manager/hire-approvals", false);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.debug("[InterviewEmail] manager fan-out (complete) failed: {}", e.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private Map<String, Object> scheduledVars(Interview iv, Application app, User applicant) {
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("firstName", firstName(applicant));
        vars.put("jobTitle", jobTitle(app));
        vars.put("scheduledForLocal", iv.getScheduledAt() != null
                ? LOCAL_FMT.format(iv.getScheduledAt().atZone(zone(iv.getTimezone())))
                : "TBD");
        vars.put("timezone", iv.getTimezone() != null ? iv.getTimezone() : "UTC");
        vars.put("zoomJoinUrl", iv.getZoomJoinUrl() != null ? iv.getZoomJoinUrl()
                : "(meeting link will follow)");
        vars.put("interviewerName", iv.getInterviewer() != null
                ? iv.getInterviewer().getFullName() : "your interviewer");
        vars.put("prepInstructions", iv.getPrepInstructions() != null
                ? iv.getPrepInstructions() : "No additional prep required.");
        return vars;
    }

    private static ZoneId zone(String tz) {
        try { return tz != null ? ZoneId.of(tz) : ZoneId.of("UTC"); }
        catch (Exception e) { return ZoneId.of("UTC"); }
    }

    private static String humanReason(String code) {
        if (code == null) return "scheduling change";
        try { return ReasonCode.valueOf(code).humanLabel(); }
        catch (Exception e) { return code.toLowerCase().replace('_', ' '); }
    }

    private static User applicantUser(Application app) {
        if (app == null || app.getCandidate() == null
                || app.getCandidate().getUser() == null) return null;
        return app.getCandidate().getUser();
    }

    private static UUID applicantUserIdOf(Interview iv) {
        User u = applicantUser(iv.getApplication());
        return u != null ? u.getId() : null;
    }

    private static String firstName(User u) {
        if (u == null) return "Applicant";
        String full = u.getFullName();
        if (full == null || full.isBlank()) return "Applicant";
        return full.trim().split("\\s+", 2)[0];
    }

    private static String jobTitle(Application app) {
        if (app == null || app.getJobPosting() == null) return "the role";
        JobPosting jp = app.getJobPosting();
        return jp.getTitle() != null ? jp.getTitle() : "the role";
    }

    private static String cap(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
