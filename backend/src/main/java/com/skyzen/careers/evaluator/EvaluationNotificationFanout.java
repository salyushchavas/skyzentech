package com.skyzen.careers.evaluator;

import com.skyzen.careers.entity.InternEvaluation;
import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.erm.CommunicationTemplateService;
import com.skyzen.careers.notification.EmailProvider;
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
        // CC: ERM + Manager + Trainer. Skip evaluator (they're the actor on
        // outbound events) — caller dispatches to them separately on ack.
        for (UUID id : new UUID[]{lc.getErmId(), lc.getManagerId(), lc.getTrainerId()}) {
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
            emailProvider.sendRendered(recipient.getEmail(),
                    r.get().subject() != null ? r.get().subject() : key,
                    r.get().body() != null ? r.get().body() : "");
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
}
