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

    public record Seed(
            String key, String channel, String subject, String body, String vars
    ) {}

    /** ERM Phase 7 — exposed so the Settings "Restore default" flow can
     *  fetch the originally-seeded values for a given (key, channel). */
    public java.util.Optional<Seed> findSeed(String key, String channel) {
        if (key == null || channel == null) return java.util.Optional.empty();
        return SEEDS.stream()
                .filter(s -> key.equals(s.key()) && channel.equals(s.channel()))
                .findFirst();
    }

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
                    "firstName,exitDate"),
            // ── ERM Phase 3 — interview lifecycle templates ─────────────────
            new Seed(
                    "INTERVIEW_SCHEDULED", "EMAIL",
                    "Your Skyzen interview is scheduled for {{scheduledForLocal}}",
                    "Hello {{firstName}},\n\n"
                            + "Your interview for {{jobTitle}} is scheduled for "
                            + "{{scheduledForLocal}} {{timezone}}.\n\n"
                            + "Join via this link: {{zoomJoinUrl}}\n"
                            + "Interviewer: {{interviewerName}}\n\n"
                            + "Prep: {{prepInstructions}}\n\n"
                            + "Reply to this email if you need to reschedule.\n\n"
                            + "— Skyzen ERM",
                    "firstName,jobTitle,scheduledForLocal,timezone,zoomJoinUrl,"
                            + "interviewerName,prepInstructions"),
            new Seed(
                    "INTERVIEW_RESCHEDULED", "EMAIL",
                    "Your Skyzen interview has been rescheduled",
                    "Hello {{firstName}},\n\n"
                            + "Your interview for {{jobTitle}} has been rescheduled to "
                            + "{{newScheduledForLocal}} {{timezone}}.\n\n"
                            + "Reason: {{rescheduleReasonHuman}}\n"
                            + "Updated link: {{zoomJoinUrl}}\n\n"
                            + "— Skyzen ERM",
                    "firstName,jobTitle,newScheduledForLocal,timezone,"
                            + "rescheduleReasonHuman,zoomJoinUrl"),
            new Seed(
                    "INTERVIEW_CANCELLED", "EMAIL",
                    "Your Skyzen interview has been cancelled",
                    "Hello {{firstName}},\n\n"
                            + "Your interview for {{jobTitle}} has been cancelled.\n\n"
                            + "{{cancellationMessage}}\n\n"
                            + "We will follow up shortly with next steps.\n\n"
                            + "— Skyzen ERM",
                    "firstName,jobTitle,cancellationMessage"),
            // ── ERM Phase 4 — offer + new-hire templates ────────────────────
            new Seed(
                    "OFFER_LETTER", "EMAIL",
                    "Your offer from Skyzen Tech — {{roleTitle}}",
                    "Hello {{firstName}},\n\n"
                            + "We're delighted to extend an offer for the {{roleTitle}} role at "
                            + "Skyzen Tech.\n\n"
                            + "Tentative start: {{tentativeStartDate}}\n"
                            + "Compensation: {{compensationSummary}}\n"
                            + "Worksite: {{worksite}}\n"
                            + "Expected hours: {{expectedHoursPerWeek}}/week\n\n"
                            + "{{contingencies}}\n\n"
                            + "Please review and sign via the DocuSign link in the separate "
                            + "DocuSign email within {{expiryDays}} days.\n\n"
                            + "— {{ermName}}",
                    "firstName,roleTitle,tentativeStartDate,compensationSummary,"
                            + "worksite,expectedHoursPerWeek,contingencies,expiryDays,ermName"),
            new Seed(
                    "OFFER_REMINDER", "EMAIL",
                    "Reminder: your Skyzen offer is awaiting signature",
                    "Hello {{firstName}},\n\n"
                            + "This is a reminder that your offer for {{roleTitle}} is awaiting "
                            + "your signature. The offer expires on {{expiryDate}}.\n\n"
                            + "Please complete via the original DocuSign link.\n\n"
                            + "— {{ermName}}",
                    "firstName,roleTitle,expiryDate,ermName"),
            new Seed(
                    "OFFER_VOIDED", "EMAIL",
                    "Your Skyzen offer has been withdrawn",
                    "Hello {{firstName}},\n\n"
                            + "We regret to inform you that the offer extended to you for "
                            + "{{roleTitle}} has been withdrawn.\n\n"
                            + "{{voidReasonHuman}}\n\n"
                            + "If you have questions, please reach out.\n\n"
                            + "— {{ermName}}",
                    "firstName,roleTitle,voidReasonHuman,ermName"),
            new Seed(
                    "REPORTING_STRUCTURE_ASSIGNED", "EMAIL",
                    "You've been assigned to a new intern at Skyzen",
                    "Hello {{recipientFirstName}},\n\n"
                            + "You've been assigned as the {{role}} for {{internName}} "
                            + "({{employeeId}}). Internship starts {{tentativeStartDate}}.\n\n"
                            + "Open your dashboard to view their profile and prepare for "
                            + "onboarding.\n\n— Skyzen ERM",
                    "recipientFirstName,role,internName,employeeId,tentativeStartDate"),
            new Seed(
                    "START_DATE_UPDATED", "EMAIL",
                    "Your Skyzen start date has been updated",
                    "Hello {{firstName}},\n\n"
                            + "Your tentative start date is now {{newDate}}. Please update "
                            + "your calendar.\n\n— {{ermName}}",
                    "firstName,newDate,ermName"),
            // ── ERM Phase 5 — onboarding review + compliance templates ───────
            new Seed(
                    "ONBOARDING_ITEM_ACCEPTED", "EMAIL",
                    "Your {{documentName}} has been accepted",
                    "Hello {{firstName}},\n\n"
                            + "Your {{documentName}} submission has been reviewed and "
                            + "accepted. No further action is needed for this item.\n\n"
                            + "Open your dashboard to track the remaining onboarding "
                            + "documents.\n\n— Skyzen ERM",
                    "firstName,documentName"),
            new Seed(
                    "ONBOARDING_ITEM_REJECTED", "EMAIL",
                    "Action needed: {{documentName}} requires correction",
                    "Hello {{firstName}},\n\n"
                            + "Your {{documentName}} submission needs correction before it "
                            + "can be accepted.\n\n"
                            + "Reviewer comments: {{ermComments}}\n\n"
                            + "Please update and resubmit from your dashboard.\n\n"
                            + "— {{ermName}}",
                    "firstName,documentName,ermComments,ermName"),
            new Seed(
                    "ONBOARDING_ITEM_RESEND", "EMAIL",
                    "Please resend: {{documentName}}",
                    "Hello {{firstName}},\n\n"
                            + "We need a fresh copy of your {{documentName}}.\n\n"
                            + "Reason: {{ermComments}}\n\n"
                            + "Please re-upload from your dashboard at your earliest "
                            + "convenience.\n\n— {{ermName}}",
                    "firstName,documentName,ermComments,ermName"),
            new Seed(
                    "ONBOARDING_PACKET_ACCEPTED", "EMAIL",
                    "Your Skyzen onboarding packet is complete",
                    "Hello {{firstName}},\n\n"
                            + "All required onboarding documents have been accepted. "
                            + "Welcome aboard — your first day is {{firstDayOfEmployment}}.\n\n"
                            + "Your reporting team will reach out with project details "
                            + "shortly.\n\n— Skyzen ERM",
                    "firstName,firstDayOfEmployment"),
            new Seed(
                    "EVERIFY_CASE_OPENED", "EMAIL",
                    "Your E-Verify case has been opened",
                    "Hello {{firstName}},\n\n"
                            + "A federal E-Verify case has been opened to confirm your "
                            + "employment eligibility. No action is required from you at "
                            + "this time — we will contact you only if additional "
                            + "verification is needed.\n\n— Skyzen ERM",
                    "firstName"),
            new Seed(
                    "EVERIFY_TENTATIVE_NONCONFIRMATION", "EMAIL",
                    "Action needed: your E-Verify case requires follow-up",
                    "Hello {{firstName}},\n\n"
                            + "Your E-Verify case returned a Tentative Nonconfirmation "
                            + "(TNC). This often resolves quickly once we exchange "
                            + "additional information.\n\n"
                            + "Please reach out to {{ermName}} within 10 federal "
                            + "business days to decide whether to contest. We will guide "
                            + "you through the next steps.\n\n— Skyzen ERM",
                    "firstName,ermName"),
            new Seed(
                    "EVERIFY_AUTHORIZED", "EMAIL",
                    "Your E-Verify case is closed — employment authorized",
                    "Hello {{firstName}},\n\n"
                            + "Your E-Verify case has been closed with Employment "
                            + "Authorized. No further action is needed.\n\n— Skyzen ERM",
                    "firstName"),
            new Seed(
                    "WORK_AUTH_EXPIRING", "EMAIL",
                    "Your work authorization expires on {{expirationDate}}",
                    "Hello {{firstName}},\n\n"
                            + "Our records show that your {{workAuthType}} expires on "
                            + "{{expirationDate}} ({{daysUntilExpiration}} days away).\n\n"
                            + "Please connect with {{ermName}} as soon as possible to "
                            + "share updated documentation or discuss extension "
                            + "options.\n\n— Skyzen ERM",
                    "firstName,workAuthType,expirationDate,daysUntilExpiration,ermName")
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
