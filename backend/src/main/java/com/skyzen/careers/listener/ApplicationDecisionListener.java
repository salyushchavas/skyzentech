package com.skyzen.careers.listener;

import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.erm.CommunicationTemplate;
import com.skyzen.careers.erm.CommunicationTemplateService;
import com.skyzen.careers.erm.application.ErmApplicationService;
import com.skyzen.careers.event.ApplicationDecisionEvent;
import com.skyzen.careers.event.ApplicationInfoProvidedEvent;
import com.skyzen.careers.notification.EmailProvider;
import com.skyzen.careers.notification.UserNotificationDispatcher;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * ERM Phase 2 — fans out per-decision side effects after AFTER_COMMIT.
 *
 * <ul>
 *   <li>HOLD / REQUEST_INFO / REJECT — render the matching
 *       {@code CommunicationTemplate}, send email, dispatch
 *       UserNotification to applicant, persist rendered body on the
 *       decision log row.</li>
 *   <li>SHORTLIST — dispatch UserNotification to all users with role
 *       MANAGER (Phase 4 will narrow once job→manager mapping lands).</li>
 *   <li>INFO_PROVIDED — dispatch in-app notification to ERM owner.</li>
 * </ul>
 *
 * <p>Best-effort end-to-end: failures log and continue. Hard-coded
 * fallback body when template absent so the applicant always gets
 * something coherent.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ApplicationDecisionListener {

    private static final String INTERN_DASH = "/careers/intern";
    private static final String ERM_DASH = "/careers/erm/applications";

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final CommunicationTemplateService templateService;
    private final EmailProvider emailProvider;
    private final UserNotificationDispatcher dispatcher;
    private final ErmApplicationService ermApplicationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDecision(ApplicationDecisionEvent e) {
        if (e == null || e.getApplicationId() == null) return;
        try {
            handle(e);
        } catch (Exception ex) {
            log.warn("[ApplicationDecision] handler failed (non-fatal): {}", ex.getMessage());
        }
    }

    private void handle(ApplicationDecisionEvent e) {
        Application app = applicationRepository.findById(e.getApplicationId()).orElse(null);
        if (app == null) return;
        Candidate c = app.getCandidate();
        User applicant = c != null ? c.getUser() : null;
        JobPosting jp = app.getJobPosting();
        StaffingEntity ent = jp != null ? jp.getEntity() : null;
        User ermActor = userRepository.findById(e.getDecidedByUserId()).orElse(null);

        String firstName = applicant != null ? firstName(applicant) : "Applicant";
        String email = applicant != null ? applicant.getEmail() : null;
        String jobTitle = jp != null ? jp.getTitle() : "the role";
        String ermName = ermActor != null && ermActor.getFullName() != null
                ? ermActor.getFullName() : "Skyzen ERM";

        switch (e.getDecision()) {
            case "SHORTLIST" -> dispatchManagerOnShortlist(applicant, jobTitle, e.getApplicationId());
            case "HOLD" -> renderAndSend("APPLICATION_HOLD",
                    Map.of("firstName", firstName, "jobTitle", jobTitle,
                            "ermName", ermName,
                            "supportEmail", "support@skyzentech.com"),
                    email, applicant, e,
                    "Your Skyzen application — under review",
                    "Hello " + firstName + ",\n\nYour application for "
                            + jobTitle + " is under extended review. We'll be in touch.\n\n— Skyzen ERM");
            case "REJECT" -> renderAndSend("APPLICATION_REJECT",
                    Map.of("firstName", firstName, "jobTitle", jobTitle,
                            "ermName", ermName,
                            "supportEmail", "support@skyzentech.com"),
                    email, applicant, e,
                    "Update on your Skyzen application",
                    "Hello " + firstName + ",\n\nAfter careful review of your application for "
                            + jobTitle + ", we have decided not to proceed. We wish you the best.\n\n— Skyzen ERM");
            case "REQUEST_INFO" -> {
                String fields = e.getInfoRequestedFields() == null
                        || e.getInfoRequestedFields().isEmpty()
                        ? "additional information"
                        : String.join(", ", humanizeFieldList(e.getInfoRequestedFields()));
                Map<String, Object> vars = new LinkedHashMap<>();
                vars.put("firstName", firstName);
                vars.put("jobTitle", jobTitle);
                vars.put("infoRequested", fields);
                vars.put("ermName", ermName);
                vars.put("supportEmail", "support@skyzentech.com");
                vars.put("deepLink", "https://www.skyzentech.com/careers/intern/applications/"
                        + e.getApplicationId());
                renderAndSend("APPLICATION_REQUEST_INFO", vars, email, applicant, e,
                        "Skyzen application — additional information needed",
                        "Hello " + firstName + ",\n\nWe are reviewing your application for "
                                + jobTitle + " and need: " + fields
                                + ". Please update your application in your Skyzen dashboard.\n\n— Skyzen ERM");
            }
            default -> {
                // Other decisions (RESUME_FROM_HOLD) — no fan-out.
            }
        }
    }

    private void renderAndSend(String templateKey,
                                Map<String, Object> vars,
                                String applicantEmail,
                                User applicant,
                                ApplicationDecisionEvent event,
                                String fallbackSubject,
                                String fallbackBody) {
        String subject = fallbackSubject;
        String body = fallbackBody;
        try {
            var rendered = templateService.render(templateKey, "EMAIL", vars).orElse(null);
            if (rendered != null) {
                subject = rendered.subject() != null ? rendered.subject() : fallbackSubject;
                body = rendered.body() != null ? rendered.body() : fallbackBody;
            } else {
                log.info("[ApplicationDecision] template {} missing — using hard-coded copy",
                        templateKey);
            }
        } catch (Exception e) {
            log.warn("[ApplicationDecision] template render failed for {} (non-fatal): {}",
                    templateKey, e.getMessage());
        }
        if (applicantEmail != null && !applicantEmail.isBlank()) {
            try {
                emailProvider.sendRendered(applicantEmail, subject, body);
            } catch (Exception e) {
                log.warn("[ApplicationDecision] email send failed (non-fatal) for {}: {}",
                        applicantEmail, e.getMessage());
            }
        }
        try {
            if (applicant != null) {
                dispatcher.dispatch(applicant.getId(), "APPLICATION_" + event.getDecision(),
                        applicant.getId(),
                        cap(subject, 200), cap(body, 400),
                        "/careers/intern/applications/" + event.getApplicationId(),
                        applicantEmail != null && !applicantEmail.isBlank());
            }
        } catch (Exception e) {
            log.debug("[ApplicationDecision] applicant dispatch failed: {}", e.getMessage());
        }
        try {
            ermApplicationService.recordRenderedMessage(event.getApplicationId(), body);
        } catch (Exception e) {
            log.debug("[ApplicationDecision] backfill failed: {}", e.getMessage());
        }
    }

    private void dispatchManagerOnShortlist(User applicant, String jobTitle, UUID applicationId) {
        if (applicant == null) return;
        try {
            List<User> managers = userRepository.findByRole(UserRole.MANAGER);
            String title = "Applicant shortlisted: " + applicant.getFullName();
            String body = "An applicant for " + jobTitle + " was shortlisted by ERM.";
            String url = "/careers/manager";
            for (User m : managers) {
                if (m == null || m.getId() == null) continue;
                try {
                    dispatcher.dispatch(m.getId(), "APPLICATION_SHORTLIST",
                            applicant.getId(),
                            cap(title, 200), cap(body, 400), url, false);
                } catch (Exception e) {
                    log.debug("[ApplicationDecision] manager dispatch failed: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("[ApplicationDecision] manager fan-out failed (non-fatal): {}",
                    e.getMessage());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onInfoProvided(ApplicationInfoProvidedEvent e) {
        if (e == null) return;
        try {
            String title = "Applicant provided requested information";
            String body = "An applicant updated their application; ready for re-review.";
            String url = ERM_DASH + "/" + e.getApplicationId();
            if (e.getErmOwnerId() != null) {
                dispatcher.dispatch(e.getErmOwnerId(), "APPLICATION_INFO_PROVIDED",
                        e.getApplicantUserId(),
                        cap(title, 200), cap(body, 400), url, false);
            }
        } catch (Exception ex) {
            log.debug("[ApplicationDecision] info-provided dispatch failed: {}", ex.getMessage());
        }
    }

    private static String firstName(User u) {
        String full = u.getFullName();
        if (full == null || full.isBlank()) return "Applicant";
        return full.trim().split("\\s+", 2)[0];
    }

    private static List<String> humanizeFieldList(List<String> fields) {
        return fields.stream().map(f -> switch (f) {
            case "resume" -> "Updated resume";
            case "workAuth" -> "Work authorization details";
            case "education" -> "Education verification";
            case "other" -> "Additional details";
            default -> f;
        }).toList();
    }

    private static String cap(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
