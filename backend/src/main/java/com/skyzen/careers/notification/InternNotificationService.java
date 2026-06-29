package com.skyzen.careers.notification;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.MailHandoverState;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * One-call helper for sending an INTERNAL mail to an active intern
 * (employee) when a meaningful action happens. Centralised so every
 * post-activation event uses the same gates + send path.
 *
 * <h2>Gates (both must pass; otherwise no send, no error)</h2>
 * <ol>
 *   <li><b>True-active</b> — {@code intern_lifecycles.active_status = 'ACTIVE'}.
 *       Same signal the tracker, dashboard mode, and nav swap key off.
 *       A pre-active intern (still in onboarding) gets nothing — they
 *       don't yet have a company mailbox and the notifications aren't
 *       meaningful until they're a working employee.</li>
 *   <li><b>Mailbox ready</b> — {@code user.mailHandoverState = ACTIVATED}
 *       AND {@code user.mailAccountId != null}. The
 *       {@link BridgingEmailProvider} intercept routes
 *       {@link EmailProvider#sendBrandedHtml} to
 *       {@code MailMessageService.deliverInternalNotification} only
 *       under this condition; otherwise it would fall through to
 *       external SMTP, which the brief explicitly rules out for these
 *       employee-side notifications.</li>
 * </ol>
 *
 * <h2>Delivery</h2>
 * Calls {@link EmailProvider#sendBrandedHtml} with the intern's
 * personal Gmail (which {@code users.email} still holds post-handover —
 * the bridge looks up the user by that key and routes to the linked
 * company mailbox). The send is wrapped in try/catch so a delivery
 * failure NEVER breaks the calling action — the notification is a
 * niceness, not a side-effect the workflow depends on.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InternNotificationService {

    private final UserRepository userRepository;
    private final InternLifecycleRepository internLifecycleRepository;
    private final EmailProvider emailProvider;

    /**
     * Send an internal mail to the intern. Silently skips when either
     * gate fails. Never throws; failures are logged at warn.
     */
    public void notifyIntern(UUID internUserId, String subject,
                              String plainBody, String htmlBody) {
        if (internUserId == null) return;
        if (subject == null || subject.isBlank()) return;
        try {
            User user = userRepository.findById(internUserId).orElse(null);
            if (user == null) {
                log.debug("[InternNotification] skip — user not found: {}", internUserId);
                return;
            }
            if (user.getEmail() == null || user.getEmail().isBlank()) {
                log.debug("[InternNotification] skip — user has no email: {}", internUserId);
                return;
            }
            InternLifecycle lc = internLifecycleRepository
                    .findByUserId(internUserId).orElse(null);
            if (lc == null || !"ACTIVE".equals(lc.getActiveStatus())) {
                log.debug("[InternNotification] skip — intern not ACTIVE: {} (status={})",
                        internUserId, lc == null ? "null" : lc.getActiveStatus());
                return;
            }
            if (user.getMailHandoverState() != MailHandoverState.ACTIVATED
                    || user.getMailAccountId() == null) {
                log.debug("[InternNotification] skip — mailbox not yet ACTIVATED for {} (state={})",
                        internUserId, user.getMailHandoverState());
                return;
            }
            // EmailProvider.sendBrandedHtml goes through BridgingEmailProvider
            // which detects mailHandoverState=ACTIVATED + mailAccountId set
            // and routes the message via MailMessageService.deliverInternal
            // -Notification — landing in the intern's company mailbox
            // rather than external SMTP. No CC, no fan-out — single-
            // recipient internal delivery per the brief.
            String safeHtml = htmlBody != null && !htmlBody.isBlank() ? htmlBody
                    : plainTextToSimpleHtml(plainBody);
            emailProvider.sendBrandedHtml(user.getEmail(), subject,
                    plainBody != null ? plainBody : subject, safeHtml);
            log.info("[InternNotification] sent '{}' to intern={}", subject, internUserId);
        } catch (Exception e) {
            // Notification failure is never fatal — the calling action
            // already committed; logging at warn surfaces it without
            // blocking the workflow.
            log.warn("[InternNotification] notifyIntern '{}' for {} failed (non-fatal): {}",
                    subject, internUserId, e.getMessage());
        }
    }

    /** Minimal HTML wrapper for callers that only pass plain text. */
    private static String plainTextToSimpleHtml(String plain) {
        if (plain == null || plain.isBlank()) return "<p></p>";
        return "<p>" + escape(plain).replace("\n", "<br>") + "</p>";
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
