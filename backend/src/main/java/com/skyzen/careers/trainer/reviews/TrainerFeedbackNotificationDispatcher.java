package com.skyzen.careers.trainer.reviews;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.ProjectSubmission;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.erm.CommunicationTemplateService;
import com.skyzen.careers.intern.OrgTeamResolver;
import com.skyzen.careers.notification.EmailProvider;
import com.skyzen.careers.notification.UserNotificationDispatcher;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Trainer Phase 3 — fan-out for the doc §9 Feedback Form decisions.
 * The intern always receives the FEEDBACK_PUBLISHED email + in-app
 * notification when the trainer commits a decision (ACCEPT /
 * REQUEST_REVISION / ESCALATE). Evaluator + Manager + ERM get an in-app
 * cue; ERM additionally receives an in-app PROJECT_ESCALATED notification
 * when the decision is ESCALATE so the new
 * {@link com.skyzen.careers.entity.ExceptionRecord} doesn't get lost.
 *
 * <p>NO_ACTION_YET dispatches nothing — silent state for trainer
 * follow-up.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TrainerFeedbackNotificationDispatcher {

    private static final String INTERN_PROJECTS = "/careers/intern/projects";
    private static final String TRAINER_REVIEWS = "/careers/trainer/pending-reviews";
    private static final String ERM_EXCEPTIONS = "/careers/erm/exception-records";

    private final UserRepository userRepository;
    private final InternLifecycleRepository lifecycleRepository;
    private final CommunicationTemplateService templateService;
    private final EmailProvider emailProvider;
    private final UserNotificationDispatcher inApp;
    private final OrgTeamResolver orgTeamResolver;

    public void dispatchFeedbackPublished(Project project,
                                           ProjectSubmission submission,
                                           User trainer, String decision) {
        if (project == null || trainer == null) return;
        InternLifecycle lc = project.getInternLifecycleId() != null
                ? lifecycleRepository.findById(project.getInternLifecycleId())
                        .orElse(null) : null;
        if (lc == null || lc.getUserId() == null) return;
        User intern = userRepository.findById(lc.getUserId()).orElse(null);
        if (intern == null) return;

        String label = humanLabel(decision);
        String dl = INTERN_PROJECTS + "/" + project.getId();

        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("firstName", firstName(intern));
        vars.put("trainerName", nz(trainer.getFullName()));
        vars.put("projectTitle", nz(project.getTitle()));
        vars.put("decisionLabel", label);
        vars.put("technicalScore", submission != null
                ? submission.getTechnicalScore() : null);
        vars.put("communicationScore", submission != null
                ? submission.getCommunicationScore() : null);
        vars.put("reviewNotes", submission != null
                ? nz(submission.getTrainerFeedback()) : "");
        vars.put("nextActionBlurb", nextActionText(
                submission != null ? submission.getNextAction() : null));
        vars.put("deepLink", dl);

        // ── Intern (always) ──────────────────────────────────────────────
        try {
            renderAndSend("FEEDBACK_PUBLISHED", vars, intern);
            inApp.dispatch(intern.getId(), "FEEDBACK_PUBLISHED",
                    intern.getId(),
                    "Project feedback: " + project.getTitle(),
                    label + (submission != null && submission.getTrainerFeedback() != null
                            ? " — " + truncate(submission.getTrainerFeedback(), 120) : ""),
                    dl, true);
        } catch (Exception e) {
            log.warn("[TrainerFeedbackNotify] intern dispatch failed: {}",
                    e.getMessage());
        }

        // ── Evaluator + Manager (in-app cue) ─────────────────────────────
        // Evaluator resolves through OrgTeamResolver so the org-wide
        // singleton (DEFAULT_EVALUATOR_EMAIL) gets the cue when the
        // per-intern evaluator_id was never stamped. Manager stays
        // direct — genuinely per-intern.
        for (UUID staff : new UUID[]{orgTeamResolver.resolveEvaluatorId(lc), lc.getManagerId()}) {
            if (staff == null) continue;
            tryInApp(staff, "FEEDBACK_PUBLISHED", intern.getId(),
                    label + " — " + intern.getFullName(),
                    project.getTitle(), TRAINER_REVIEWS);
        }

        // ── ERM (in-app cue + ESCALATE-only flag) ────────────────────────
        if (lc.getErmId() != null) {
            tryInApp(lc.getErmId(), "FEEDBACK_PUBLISHED", intern.getId(),
                    label + " — " + intern.getFullName(),
                    project.getTitle(), TRAINER_REVIEWS);
            if ("ESCALATE".equals(decision)) {
                tryInApp(lc.getErmId(), "PROJECT_ESCALATED", intern.getId(),
                        "Project escalation — " + intern.getFullName(),
                        "Trainer flagged " + project.getTitle()
                                + ". Open the Exceptions dashboard for context.",
                        ERM_EXCEPTIONS);
            }
        }
    }

    private void renderAndSend(String key, Map<String, Object> vars, User recipient) {
        if (recipient == null || recipient.getEmail() == null) return;
        try {
            Optional<CommunicationTemplateService.Rendered> opt =
                    templateService.render(key, "EMAIL", vars);
            if (opt.isEmpty()) return;
            var rendered = opt.get();
            emailProvider.sendRendered(recipient.getEmail(),
                    rendered.subject() != null ? rendered.subject() : key,
                    rendered.body() != null ? rendered.body() : "");
        } catch (Exception e) {
            log.warn("[TrainerFeedbackNotify] {} render failed: {}", key, e.getMessage());
        }
    }

    private void tryInApp(UUID recipient, String eventType, UUID subjectUserId,
                           String title, String body, String url) {
        try {
            inApp.dispatch(recipient, eventType, subjectUserId, title, body, url, false);
        } catch (Exception e) {
            log.debug("[TrainerFeedbackNotify] in-app to {} failed: {}",
                    recipient, e.getMessage());
        }
    }

    private static String humanLabel(String decision) {
        if (decision == null) return "Feedback";
        return switch (decision) {
            case "ACCEPT" -> "Project accepted";
            case "REQUEST_REVISION" -> "Revision requested";
            case "ESCALATE" -> "Escalated";
            case "NO_ACTION_YET" -> "Reviewed (no action yet)";
            default -> "Feedback";
        };
    }

    private static String nextActionText(String code) {
        if (code == null || code.isBlank()) return "";
        return switch (code.toUpperCase()) {
            case "REVISION" -> "Next action: revise + re-submit.";
            case "NEXT_PROJECT" -> "Next action: move on to the next project.";
            case "EXTRA_TRAINING" -> "Next action: extra training assigned.";
            case "ESCALATION" -> "Next action: escalation in progress.";
            default -> "";
        };
    }

    private static String firstName(User u) {
        if (u == null || u.getFullName() == null) return "there";
        String[] parts = u.getFullName().trim().split("\\s+", 2);
        return parts.length > 0 && !parts[0].isEmpty() ? parts[0] : "there";
    }

    private static String nz(String s) { return s == null ? "" : s; }

    private static String truncate(String s, int n) {
        if (s == null) return "";
        return s.length() <= n ? s : s.substring(0, n) + "…";
    }
}
