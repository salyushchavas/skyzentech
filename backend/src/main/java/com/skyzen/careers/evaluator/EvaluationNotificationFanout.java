package com.skyzen.careers.evaluator;

import com.skyzen.careers.entity.I983Evaluation;
import com.skyzen.careers.entity.InternEvaluation;
import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.erm.CommunicationTemplateService;
import com.skyzen.careers.intern.OrgTeamResolver;
import com.skyzen.careers.notification.EmailProvider;
import com.skyzen.careers.notification.MeetingEmailHtmlBuilder;
import com.skyzen.careers.notification.SchedulerMeetingEmailSender;
import com.skyzen.careers.notification.UserNotificationDispatcher;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Evaluator Phase 2 — 4-recipient notification fan-out for the monthly
 * evaluation lifecycle. Best-effort: rendering or send failures are logged
 * but never roll back the workflow transaction.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EvaluationNotificationFanout {

    private final UserRepository userRepo;
    private final UserNotificationDispatcher inApp;
    private final EmailProvider emailProvider;
    private final CommunicationTemplateService templateService;
    private final OrgTeamResolver orgTeamResolver;
    private final SchedulerMeetingEmailSender schedulerEmail;

    @Value("${app.frontend.base-url:https://www.skyzentech.com}")
    private String frontendBaseUrl;

    public void evaluationScheduled(InternEvaluation ev, InternLifecycle lc, User evaluator) {
        User intern = userRepo.findById(lc.getUserId()).orElse(null);
        if (intern == null) return;
        String firstName = firstName(intern);
        String date = ev.getScheduledFor() != null
                ? DATE_FMT.format(ev.getScheduledFor().atZone(ZoneId.of("UTC")))
                : "TBD";
        String evaluatorName = evaluator != null && evaluator.getFullName() != null
                ? evaluator.getFullName() : "your Evaluator";
        String deepLink = link("/careers/intern/evaluations");

        // Email — intern
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("firstName", firstName);
        vars.put("evaluationType", "monthly");
        vars.put("evaluatorName", evaluatorName);
        vars.put("scheduledDateLocal", date);
        vars.put("timezone", ev.getTimezone() != null ? ev.getTimezone() : "UTC");
        vars.put("zoomLink", ev.getZoomJoinUrl() != null ? ev.getZoomJoinUrl() : "(link will follow)");
        renderAndEmail("EVALUATION_SCHEDULED", intern, vars);

        // In-app — intern
        tryInApp(intern.getId(), "EVALUATION_SCHEDULED", intern.getId(),
                "Evaluation scheduled",
                evaluatorName + " has scheduled your monthly evaluation for " + date,
                deepLink);

        // CC fan-out — ERM + Manager + Trainer (in-app only; email kept terse)
        fanoutInApp(lc, "EVALUATION_SCHEDULED",
                "Monthly evaluation scheduled for " + safeName(intern),
                evaluatorName + " · " + date,
                "/careers/erm/active-interns");

        // Email — evaluator (scheduler), with the Webex host key so they
        // can claim host control after joining. Best-effort; failures are
        // logged inside the sender. Skipped when no zoom join url exists
        // (creation must have failed before this fan-out fired).
        if (evaluator != null) {
            String participantLabel = "with " + safeName(intern) + " (intern)";
            schedulerEmail.send(
                    evaluator.getEmail(),
                    firstName(evaluator),
                    "Evaluation scheduled",
                    "Monthly evaluation",
                    participantLabel,
                    ev.getScheduledFor(),
                    ev.getTimezone(),
                    ev.getZoomJoinUrl(),
                    ev.getZoomStartUrl(),
                    ev.getZoomMeetingId());
        }
    }

    public void evaluationPublished(InternEvaluation ev, InternLifecycle lc, User evaluator) {
        User intern = userRepo.findById(lc.getUserId()).orElse(null);
        if (intern == null) return;
        String firstName = firstName(intern);
        String evaluatorName = evaluator != null && evaluator.getFullName() != null
                ? evaluator.getFullName() : "your Evaluator";
        String summary = "Overall " + (ev.getOverallScore() != null ? ev.getOverallScore() : "—")
                + " / 5 · " + (ev.getRecommendation() != null
                        ? ev.getRecommendation().replace('_', ' ').toLowerCase()
                        : "no recommendation");
        String deepLink = link("/careers/intern/evaluations/" + ev.getId());

        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("firstName", firstName);
        vars.put("evaluatorName", evaluatorName);
        vars.put("evaluationType", "monthly");
        vars.put("ackDays", "5");
        vars.put("summaryLine", summary);
        vars.put("deepLink", deepLink);
        renderAndEmail("EVALUATION_PUBLISHED", intern, vars);

        tryInApp(intern.getId(), "EVALUATION_PUBLISHED", intern.getId(),
                "Your evaluation is ready",
                evaluatorName + " published your monthly evaluation. "
                        + "Open it to acknowledge.",
                deepLink);

        fanoutInApp(lc, "EVALUATION_PUBLISHED",
                "Evaluation published for " + safeName(intern),
                summary,
                "/careers/erm/active-interns");
    }

    public void evaluationAcknowledged(InternEvaluation ev, InternLifecycle lc, User intern) {
        if (ev.getEvaluatorId() == null) return;
        String internName = safeName(intern);
        String response = ev.getInternResponse();
        String excerpt = response != null && !response.isBlank()
                ? "Note: " + response.substring(0, Math.min(120, response.length()))
                  + (response.length() > 120 ? "…" : "")
                : "";
        String deepLink = link("/careers/evaluator/evaluations/" + ev.getId());
        tryInApp(ev.getEvaluatorId(), "EVALUATION_ACKNOWLEDGED", lc.getUserId(),
                "Acknowledged by " + internName,
                excerpt.isEmpty() ? "No additional response." : excerpt,
                deepLink);
        if (lc.getErmId() != null) {
            tryInApp(lc.getErmId(), "EVALUATION_ACKNOWLEDGED", lc.getUserId(),
                    internName + " acknowledged their evaluation",
                    excerpt,
                    deepLink);
        }
    }

    public void evaluationAmended(InternEvaluation ev, InternLifecycle lc,
                                   User evaluator, String reason) {
        User intern = userRepo.findById(lc.getUserId()).orElse(null);
        if (intern == null) return;
        String firstName = firstName(intern);
        String evaluatorName = evaluator != null && evaluator.getFullName() != null
                ? evaluator.getFullName() : "your Evaluator";
        String changeSummary = reason != null
                ? reason.substring(0, Math.min(reason.length(), 200))
                : "Details updated";
        String deepLink = link("/careers/intern/evaluations/" + ev.getId());

        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("firstName", firstName);
        vars.put("evaluatorName", evaluatorName);
        vars.put("previousAckDate", "n/a");
        vars.put("changeSummary", changeSummary);
        vars.put("deepLink", deepLink);
        renderAndEmail("EVALUATION_AMENDED", intern, vars);

        tryInApp(intern.getId(), "EVALUATION_AMENDED", intern.getId(),
                "Your evaluation has been updated",
                changeSummary + " · please re-acknowledge.",
                deepLink);

        fanoutInApp(lc, "EVALUATION_AMENDED",
                "Evaluation amended for " + safeName(intern),
                changeSummary,
                "/careers/erm/active-interns");
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private void fanoutInApp(InternLifecycle lc, String eventType,
                              String title, String body, String url) {
        // CC: ERM + Manager + Trainer. Skip evaluator (they're the actor
        // on outbound events) — caller dispatches to them separately on
        // ack. Trainer routes through OrgTeamResolver so the org-wide
        // singleton (DEFAULT_TRAINER_EMAIL) gets CC'd even when the
        // per-intern trainer_id wasn't stamped — otherwise the trainer
        // never sees evaluation events for that intern.
        UUID trainerId = orgTeamResolver.resolveTrainerId(lc);
        for (UUID id : new UUID[]{lc.getErmId(), lc.getManagerId(), trainerId}) {
            if (id != null) tryInApp(id, eventType, lc.getUserId(), title, body, url);
        }
    }

    private void tryInApp(UUID recipient, String eventType, UUID subjectUserId,
                            String title, String body, String url) {
        try {
            inApp.dispatch(recipient, eventType, subjectUserId,
                    title, body, url, false);
        } catch (Exception e) {
            log.debug("[EvaluatorFanout] in-app to {} failed: {}", recipient, e.getMessage());
        }
    }

    private void renderAndEmail(String key, User recipient, Map<String, Object> vars) {
        if (recipient == null || recipient.getEmail() == null) return;
        try {
            Optional<CommunicationTemplateService.Rendered> r =
                    templateService.render(key, "EMAIL", vars);
            if (r.isEmpty()) return;
            String subject = r.get().subject() != null ? r.get().subject() : key;
            String plain = r.get().body() != null ? r.get().body() : "";
            // HTML twin with a styled Join button for evaluation meetings
            // that carry a join URL. No-op when the template doesn't put
            // a zoomJoinUrl in vars (e.g. text-only "evaluation finalized").
            Object joinUrlVar = vars.get("zoomJoinUrl");
            String joinUrl = joinUrlVar == null ? null : joinUrlVar.toString();
            String html = MeetingEmailHtmlBuilder.build(plain, joinUrl);
            emailProvider.sendBrandedHtml(recipient.getEmail(), subject, plain, html);
        } catch (Exception e) {
            log.warn("[EvaluatorFanout] {} render failed: {}", key, e.getMessage());
        }
    }

    private String link(String path) {
        return frontendBaseUrl.replaceAll("/+$", "") + path;
    }

    private static String firstName(User u) {
        if (u == null || u.getFullName() == null) return "there";
        return u.getFullName().split("\\s+", 2)[0];
    }

    private static String safeName(User u) {
        if (u == null) return "(unknown intern)";
        return u.getFullName() != null ? u.getFullName() : u.getEmail();
    }

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("EEE MMM d, yyyy 'at' h:mm a 'UTC'");

    // ── Phase 3 — I-983 fan-out ───────────────────────────────────────────

    public void i983Scheduled(I983Evaluation ev, InternLifecycle lc, User evaluator) {
        User intern = userRepo.findById(lc.getUserId()).orElse(null);
        if (intern == null) return;
        String firstName = firstName(intern);
        String evaluatorName = evaluator != null && evaluator.getFullName() != null
                ? evaluator.getFullName() : "your Evaluator";
        String type = ev.getEvaluationType() != null
                ? ev.getEvaluationType().replace('_', ' ') : "I-983";
        String deepLink = link("/careers/intern/i983-evaluations");

        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("firstName", firstName);
        vars.put("evaluatorName", evaluatorName);
        vars.put("evaluationType", type);
        vars.put("windowStartDate", ev.getPeriodStartDate() != null
                ? ev.getPeriodStartDate().toString() : "TBD");
        vars.put("dueDate", ev.getPeriodEndDate() != null
                ? ev.getPeriodEndDate().toString() : "TBD");
        vars.put("internName", safeName(intern));
        vars.put("employeeId", lc.getEmployeeId() != null ? lc.getEmployeeId() : "");
        vars.put("deepLink", deepLink);
        renderAndEmail("I983_EVALUATION_DUE", intern, vars);

        tryInApp(intern.getId(), "I983_EVALUATION_SCHEDULED", intern.getId(),
                "I-983 evaluation scheduled",
                evaluatorName + " has scheduled your " + type + " I-983 evaluation.",
                deepLink);

        fanoutInApp(lc, "I983_EVALUATION_SCHEDULED",
                "I-983 " + type + " scheduled for " + safeName(intern),
                "Federal STEM OPT compliance",
                "/careers/erm/active-interns");
    }

    public void i983Published(I983Evaluation ev, InternLifecycle lc, User evaluator) {
        User intern = userRepo.findById(lc.getUserId()).orElse(null);
        if (intern == null) return;
        String firstName = firstName(intern);
        String evaluatorName = evaluator != null && evaluator.getFullName() != null
                ? evaluator.getFullName() : "your Evaluator";
        String type = ev.getEvaluationType() != null
                ? ev.getEvaluationType().replace('_', ' ') : "I-983";
        String deepLink = link("/careers/intern/i983-evaluations/" + ev.getId());

        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("firstName", firstName);
        vars.put("evaluatorName", evaluatorName);
        vars.put("evaluationType", type);
        vars.put("deepLink", deepLink);
        renderAndEmail("I983_EVALUATION_PUBLISHED", intern, vars);

        tryInApp(intern.getId(), "I983_EVALUATION_PUBLISHED", intern.getId(),
                "I-983 evaluation ready to sign",
                "Federal requirement — please review and sign within 7 days.",
                deepLink);

        fanoutInApp(lc, "I983_EVALUATION_PUBLISHED",
                "I-983 published for " + safeName(intern),
                type + " · DSO submission required within 10 days of ack",
                "/careers/erm/active-interns");
    }

    public void i983Acknowledged(I983Evaluation ev, InternLifecycle lc, User intern) {
        if (ev.getEvaluatorId() == null) return;
        String internName = safeName(intern);
        String deepLink = link("/careers/evaluator/i983-evaluations/" + ev.getId());
        String body = "Signature: " + (ev.getStudentTypedSignature() != null
                ? ev.getStudentTypedSignature() : "(captured)")
                + " · Submit to DSO within 10 days.";
        tryInApp(ev.getEvaluatorId(), "I983_EVALUATION_ACKNOWLEDGED", lc.getUserId(),
                "I-983 acknowledged by " + internName,
                body, deepLink);
        if (lc.getErmId() != null) {
            tryInApp(lc.getErmId(), "I983_EVALUATION_ACKNOWLEDGED", lc.getUserId(),
                    internName + " signed the I-983",
                    body, deepLink);
        }
    }

    public void i983DsoSubmitted(I983Evaluation ev, InternLifecycle lc, User actor) {
        User intern = userRepo.findById(lc.getUserId()).orElse(null);
        if (intern == null) return;
        String method = ev.getDsoSubmissionMethod() != null
                ? ev.getDsoSubmissionMethod().replace('_', ' ').toLowerCase()
                : "submitted";
        String deepLink = link("/careers/intern/i983-evaluations/" + ev.getId());
        tryInApp(intern.getId(), "I983_DSO_SUBMITTED", intern.getId(),
                "I-983 submitted to your DSO",
                "Submission method: " + method,
                deepLink);
        if (lc.getErmId() != null) {
            tryInApp(lc.getErmId(), "I983_DSO_SUBMITTED", lc.getUserId(),
                    "I-983 submitted to DSO for " + safeName(intern),
                    method, "/careers/erm/active-interns");
        }
    }

    public void i983Amended(I983Evaluation ev, InternLifecycle lc, User evaluator,
                             String reason) {
        User intern = userRepo.findById(lc.getUserId()).orElse(null);
        if (intern == null) return;
        String deepLink = link("/careers/intern/i983-evaluations/" + ev.getId());
        String summary = reason != null
                ? reason.substring(0, Math.min(reason.length(), 200))
                : "Details updated";
        tryInApp(intern.getId(), "I983_EVALUATION_AMENDED", intern.getId(),
                "Your I-983 evaluation has been updated",
                summary + " · please re-sign.",
                deepLink);
        fanoutInApp(lc, "I983_EVALUATION_AMENDED",
                "I-983 amended for " + safeName(intern),
                summary + " · DSO submission reset",
                "/careers/erm/active-interns");
    }
}
