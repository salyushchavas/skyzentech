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
 * Mail bridge Phase 5 (revised) — fires the assign-time external
 * credential email to the intern's personal Gmail.
 *
 * <p>Runs at {@code TransactionPhase.AFTER_COMMIT} so a rollback in
 * {@code MailHandoverService.assignCompanyEmail} never leaks
 * credentials for an aborted mailbox. Injects the RAW
 * {@link EmailProvider} via {@code @Qualifier("rawEmailProvider")} —
 * NOT the @Primary {@code BridgingEmailProvider} — so the send
 * unconditionally goes through SMTP to the personal Gmail. (Without
 * this qualifier the bridge would see the user is ACTIVATED + linked
 * and try to route the credential into the same mailbox the intern
 * can't sign into yet.)</p>
 *
 * <p>Framing is NOTIFICATION-INBOX, not identity. The dashboard
 * login is unchanged — the mailbox + these credentials are only for
 * reading internal Skyzen notifications at {@code /mail}.</p>
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
                + "This mailbox is where Skyzen notifications — onboarding "
                + "updates, project assignments, evaluations, reminders — "
                + "will arrive from now on. Sign in at " + webmailLoginUrl
                + " with the credentials above; you'll be asked to set a "
                + "new password on first sign-in.\n\n"
                + "Your Skyzen dashboard login is unchanged — keep using "
                + "the email and password you already have to sign into "
                + "the dashboard at the usual place.\n\n"
                + "A peek of recent messages also appears in the mail icon "
                + "next to your profile inside the dashboard.\n\n"
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
                + "<p>This mailbox is where Skyzen notifications &mdash; "
                + "onboarding updates, project assignments, evaluations, "
                + "reminders &mdash; will arrive from now on. Sign in at "
                + "<a href=\"" + escapeHtml(webmailLoginUrl) + "\">"
                + escapeHtml(webmailLoginUrl) + "</a> with the credentials "
                + "above; you'll be asked to set a new password on first "
                + "sign-in.</p>"
                + "<p>Your <strong>Skyzen dashboard login is unchanged</strong> "
                + "&mdash; keep using the email and password you already have "
                + "to sign into the dashboard at the usual place.</p>"
                + "<p style=\"color:#6b7280;font-size:13px;\">A peek of "
                + "recent messages also appears in the mail icon next to your "
                + "profile inside the dashboard.</p>"
                + "<p>&mdash; Skyzen</p>";
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
