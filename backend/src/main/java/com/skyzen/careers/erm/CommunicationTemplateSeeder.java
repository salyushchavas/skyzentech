package com.skyzen.careers.erm;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Idempotent boot-time seeder. Inserts a starter set of email templates
 * the ERM phases reference. Existing rows (matched by
 * (key, channel)) are left untouched so ERM edits made via the Phase 7
 * settings UI are never overwritten.
 */
@Component
@Order(10)
@RequiredArgsConstructor
@Slf4j
public class CommunicationTemplateSeeder implements CommandLineRunner {

    private final CommunicationTemplateRepository repository;

    private record Seed(
            String key, String channel, String subject, String body, String vars
    ) {}

    private static final List<Seed> SEEDS = List.of(
            new Seed(
                    "APPLICATION_REJECT", "EMAIL",
                    "Update on your Skyzen application",
                    "Hello {{firstName}},\n\n"
                            + "Thank you for applying to {{jobTitle}} at Skyzen. After careful "
                            + "review, we have decided not to proceed with your application at "
                            + "this time. We appreciate your interest and wish you the best.\n\n"
                            + "— Skyzen ERM",
                    "firstName,jobTitle"),
            new Seed(
                    "APPLICATION_HOLD", "EMAIL",
                    "Your Skyzen application — under review",
                    "Hello {{firstName}},\n\n"
                            + "Thank you for applying to {{jobTitle}}. Your application is "
                            + "currently under extended review. We will reach out when we have "
                            + "an update.\n\n— Skyzen ERM",
                    "firstName,jobTitle"),
            new Seed(
                    "APPLICATION_REQUEST_INFO", "EMAIL",
                    "Skyzen application — additional information needed",
                    "Hello {{firstName}},\n\n"
                            + "We are reviewing your application for {{jobTitle}} and need the "
                            + "following information: {{infoRequested}}.\n\n"
                            + "Please update your application in your Skyzen dashboard.\n\n"
                            + "— Skyzen ERM",
                    "firstName,jobTitle,infoRequested"),
            new Seed(
                    "INTERVIEW_SELECTED", "EMAIL",
                    "Great news from your Skyzen interview",
                    "Hello {{firstName}},\n\n"
                            + "We enjoyed speaking with you and would like to move forward. "
                            + "Watch for your offer letter shortly.\n\n— Skyzen ERM",
                    "firstName"),
            new Seed(
                    "INTERVIEW_HOLD", "EMAIL",
                    "Skyzen interview — under consideration",
                    "Hello {{firstName}},\n\n"
                            + "Thank you for interviewing with us. We are still in the decision "
                            + "phase and will update you soon.\n\n— Skyzen ERM",
                    "firstName"),
            new Seed(
                    "INTERVIEW_REJECTED", "EMAIL",
                    "Skyzen interview decision",
                    "Hello {{firstName}},\n\n"
                            + "Thank you for interviewing for {{jobTitle}}. After careful "
                            + "consideration, we have decided not to proceed at this time. We "
                            + "appreciate your time and interest.\n\n— Skyzen ERM",
                    "firstName,jobTitle"),
            new Seed(
                    "OFFER_DOC_REJECTED", "EMAIL",
                    "Onboarding document needs correction — {{documentName}}",
                    "Hello {{firstName}},\n\n"
                            + "The {{documentName}} you submitted needs correction: "
                            + "{{ermComments}}. Please update and resubmit from your "
                            + "dashboard.\n\n— Skyzen ERM",
                    "firstName,documentName,ermComments"),
            new Seed(
                    "EXIT_COMPLETED", "EMAIL",
                    "Your Skyzen internship has concluded",
                    "Hello {{firstName}},\n\n"
                            + "Your internship at Skyzen concluded on {{exitDate}}. Thank you "
                            + "for your contributions. Your records remain accessible in your "
                            + "dashboard. Please share your exit feedback when you have a "
                            + "moment.\n\n— Skyzen ERM",
                    "firstName,exitDate"),
            new Seed(
                    "EXIT_TERMINATED", "EMAIL",
                    "Your Skyzen employment status",
                    "Hello {{firstName}},\n\n"
                            + "This message confirms that your engagement with Skyzen ended "
                            + "on {{exitDate}}. You will receive separate communications about "
                            + "next steps from your ERM. Records remain accessible in your "
                            + "dashboard.\n\n— Skyzen ERM",
                    "firstName,exitDate"),
            new Seed(
                    "EXIT_RESIGNED", "EMAIL",
                    "Confirmation of your resignation",
                    "Hello {{firstName}},\n\n"
                            + "This confirms your resignation from Skyzen effective "
                            + "{{exitDate}}. Thank you for your contributions. Records remain "
                            + "accessible in your dashboard; please share your exit feedback "
                            + "when you have a moment.\n\n— Skyzen ERM",
                    "firstName,exitDate")
    );

    @Override
    public void run(String... args) {
        int seeded = 0;
        int skipped = 0;
        for (Seed s : SEEDS) {
            try {
                if (repository.existsByKeyAndChannel(s.key(), s.channel())) {
                    skipped++;
                    continue;
                }
                CommunicationTemplate t = CommunicationTemplate.builder()
                        .key(s.key())
                        .channel(s.channel())
                        .subjectTemplate(s.subject())
                        .bodyTemplate(s.body())
                        .variablesCsv(s.vars())
                        .active(true)
                        .build();
                repository.save(t);
                seeded++;
            } catch (Exception e) {
                log.warn("[CommunicationTemplateSeeder] seed failed for {} (non-fatal): {}",
                        s.key(), e.getMessage());
            }
        }
        log.info("[CommunicationTemplateSeeder] seeded {} templates (idempotent; {} pre-existing)",
                seeded, skipped);
    }
}
