package com.skyzen.careers.listener;

import com.skyzen.careers.event.CompanyEmailAssignedEvent;
import com.skyzen.careers.notification.EmailProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Mail bridge Phase 4 — fires THE LAST EXTERNAL email of a user's
 * lifecycle: the starting-credentials note to their personal Gmail.
 *
 * <p>Runs at {@code TransactionPhase.AFTER_COMMIT} so a rollback in
 * {@code MailHandoverService.assignCompanyEmail} never leaks
 * credentials for an aborted mailbox. Injects the RAW
 * {@link EmailProvider} via {@code @Qualifier("rawEmailProvider")} —
 * NOT the @Primary {@code BridgingEmailProvider} — so the send
 * unconditionally goes through SMTP. The bridge would otherwise see
 * the user (just promoted to PENDING_ACTIVATION) and redirect
 * external sends to {@code personal_email}, which is correct in
 * general but redundant here since the target is already
 * {@code personal_email} and we don't want to circle back through
 * the bridge for a credential payload.</p>
 *
 * <p>Best-effort: any SMTP failure is caught + logged. The handover
 * transaction has already committed; the ERM can re-issue credentials
 * via a follow-up flow if delivery fails.</p>
 */
@Component
@Slf4j
public class CompanyEmailAssignedListener {

    private final EmailProvider rawProvider;

    @Value("${app.webmail.login-url:https://www.skyzentech.com/mail/login}")
    private String webmailLoginUrl;

    @Value("${app.webmail.seed.admin-domain:skyzentech.com}")
    private String seedDomain;

    /**
     * Bridges the {@code @Qualifier("rawEmailProvider")} bean (defined in
     * {@code EmailProviderConfiguration}) into the constructor. Without
     * the qualifier, the @Primary {@code BridgingEmailProvider} would be
     * injected and external delivery would be routed through the bridge.
     */
    public CompanyEmailAssignedListener(
            @Qualifier("rawEmailProvider") EmailProvider rawProvider) {
        this.rawProvider = rawProvider;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCompanyEmailAssigned(CompanyEmailAssignedEvent event) {
        if (event == null) return;
        try {
            String to = event.getPersonalEmail();
            if (to == null || to.isBlank()) {
                log.warn("[MailHandover] cannot send credentials — personalEmail "
                        + "missing for user {}", event.getUserId());
                return;
            }
            String subject = "Your Skyzen company mailbox — starting credentials";
            String plain = plainBody(event);
            String html = htmlBody(event);
            rawProvider.sendBrandedHtml(to, subject, plain, html);
            log.info("[MailHandover] starting-credentials email sent to {} "
                    + "(company email {})", to, event.getCompanyEmail());
        } catch (Exception e) {
            log.warn("[MailHandover] starting-credentials email FAILED for {} "
                            + "(user {} company {}); ERM can re-issue: {}",
                    event.getPersonalEmail(), event.getUserId(),
                    event.getCompanyEmail(), e.getMessage());
        }
    }

    private String plainBody(CompanyEmailAssignedEvent ev) {
        return "Your Skyzen company mailbox is ready.\n\n"
                + "Mailbox email:    " + ev.getCompanyEmail() + "\n"
                + "Starting password: " + ev.getStartingPassword() + "\n\n"
                + "Two steps:\n"
                + "  1. Log into your mailbox at " + webmailLoginUrl + " — you "
                + "will be asked to set a new password on first sign-in.\n"
                + "  2. Once you've set a new password, that same email + "
                + "password also signs you into the Skyzen dashboard. Personal "
                + "Gmail will no longer receive Skyzen notifications.\n\n"
                + "This is the LAST email Skyzen will send to your personal "
                + "Gmail. Everything from now on lands in your company "
                + "mailbox.\n\n"
                + "— Skyzen";
    }

    private String htmlBody(CompanyEmailAssignedEvent ev) {
        return "<p>Your <strong>Skyzen company mailbox</strong> is ready.</p>"
                + "<table style=\"border-collapse:collapse;margin:8px 0;\">"
                + "<tr><td style=\"padding:4px 12px 4px 0;color:#6b7280;\">Mailbox email</td>"
                + "<td style=\"padding:4px 0;font-family:monospace;\">"
                + escapeHtml(ev.getCompanyEmail()) + "</td></tr>"
                + "<tr><td style=\"padding:4px 12px 4px 0;color:#6b7280;\">Starting password</td>"
                + "<td style=\"padding:4px 0;font-family:monospace;\">"
                + escapeHtml(ev.getStartingPassword()) + "</td></tr>"
                + "</table>"
                + "<ol>"
                + "<li>Log into your mailbox at "
                + "<a href=\"" + escapeHtml(webmailLoginUrl) + "\">"
                + escapeHtml(webmailLoginUrl) + "</a> — you will be asked to "
                + "set a new password on first sign-in.</li>"
                + "<li>Once you've set a new password, that same email + "
                + "password also signs you into the Skyzen dashboard. Personal "
                + "Gmail will no longer receive Skyzen notifications.</li>"
                + "</ol>"
                + "<p style=\"color:#6b7280;font-size:13px;\">This is the "
                + "<strong>last</strong> email Skyzen will send to your "
                + "personal Gmail. Everything from now on lands in your "
                + "company mailbox.</p>"
                + "<p>— Skyzen</p>";
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
