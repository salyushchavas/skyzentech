package com.skyzen.careers.notification;

import com.skyzen.careers.integration.webex.WebexService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Sends the scheduler-side "you scheduled this meeting" email. Unlike the
 * participant emails (which the {@code *NotificationDispatcher} classes
 * already render via the templated communication catalog), this email is
 * inlined: kept short, always carries the same shape, and includes the
 * 6-digit Webex host key so the scheduler can claim host control inside
 * the Webex client.
 *
 * <p>The host key is fetched on-send (not cached) because Webex rotates it
 * after the meeting's scheduled-end time. If the fetch returns null (JBH
 * disabled, host-email mismatch, or transient error) we still send the
 * email with the join button + a fallback hint — the email is a niceness,
 * not a blocker.</p>
 *
 * <p>Participants never receive this body — only the scheduler does. The
 * existing intern/applicant emails stay unchanged (join button only, no
 * host key). See {@link MeetingEmailHtmlBuilder#buildWithHostKey} for the
 * HTML shape.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SchedulerMeetingEmailSender {

    private static final DateTimeFormatter LOCAL_FMT =
            DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy 'at' h:mm a");

    private final WebexService webexService;
    private final EmailProvider emailProvider;

    /**
     * Send the scheduler email. Safe to call even when fields are null/blank
     * — short-circuits when essentials (recipient email, join url, meeting
     * id) are missing and logs at debug.
     *
     * @param recipientEmail scheduler's email address
     * @param recipientName  display name for the greeting (firstName or full)
     * @param subjectPrefix  e.g. "Weekly meeting scheduled" / "Interview
     *                       scheduled" — appended with the meeting title
     * @param meetingTitle   the meeting topic/title shown on the calendar
     * @param participantLabel the counterparty's name + label (e.g.
     *                       "with John Doe (intern)") shown in the body
     * @param scheduledFor   meeting start time
     * @param timezone       IANA zone (falls back to UTC)
     * @param joinUrl        Webex join link (same one the participant uses)
     * @param providerMeetingId WebEx meeting id used to fetch the host key
     *                       on-send
     */
    public void send(String recipientEmail, String recipientName,
                     String subjectPrefix, String meetingTitle,
                     String participantLabel, Instant scheduledFor,
                     String timezone, String joinUrl,
                     String providerMeetingId) {
        if (recipientEmail == null || recipientEmail.isBlank()
                || joinUrl == null || joinUrl.isBlank()) {
            log.debug("[SchedulerMeetingEmail] skipping send — missing recipient/join URL");
            return;
        }
        String hostKey = providerMeetingId == null ? null
                : webexService.fetchHostKey(providerMeetingId);
        ZoneId zone;
        try {
            zone = ZoneId.of(timezone == null || timezone.isBlank() ? "UTC" : timezone);
        } catch (Exception e) {
            zone = ZoneId.of("UTC");
        }
        String when = scheduledFor != null
                ? LOCAL_FMT.format(scheduledFor.atZone(zone))
                : "TBD";
        String name = recipientName == null || recipientName.isBlank()
                ? "there" : recipientName;
        String title = meetingTitle == null || meetingTitle.isBlank()
                ? "Meeting" : meetingTitle;
        String subject = subjectPrefix + " — " + title;
        StringBuilder plain = new StringBuilder();
        plain.append("Hi ").append(name).append(",\n\n")
                .append("You scheduled \"").append(title).append("\"");
        if (participantLabel != null && !participantLabel.isBlank()) {
            plain.append(" ").append(participantLabel);
        }
        plain.append(" for ").append(when).append(" (").append(zone.getId()).append(").\n\n")
                .append("Join: ").append(joinUrl).append("\n\n");
        if (hostKey != null) {
            plain.append("Host key (claim host inside Webex): ").append(hostKey).append("\n")
                    .append("Webex rotates this key after the meeting ends.\n\n");
        } else {
            plain.append("Host control: sign in to webex.com as the host account, then click ")
                    .append("the join link — you'll be promoted to host automatically.\n\n");
        }
        plain.append("— Skyzen");
        String html = MeetingEmailHtmlBuilder.buildWithHostKey(
                plain.toString(), joinUrl, null, hostKey);
        try {
            emailProvider.sendBrandedHtml(recipientEmail, subject, plain.toString(), html);
        } catch (Exception e) {
            log.warn("[SchedulerMeetingEmail] send to {} failed (non-fatal): {}",
                    recipientEmail, e.getMessage());
        }
    }
}
