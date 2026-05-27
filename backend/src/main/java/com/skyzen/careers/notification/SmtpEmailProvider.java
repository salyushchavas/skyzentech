package com.skyzen.careers.notification;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Real transactional email via Spring's JavaMailSender. Bean is created by
 * {@link EmailProviderConfiguration} only when {@code spring.mail.host} +
 * {@code spring.mail.username} are non-blank — otherwise we boot with the
 * {@link LogEmailProvider} so unconfigured environments still start cleanly.
 *
 * <h2>Multipart</h2>
 * Verification + password-reset are sent as multipart/alternative (HTML + plain
 * text) so the rendering is decent in mobile mail clients but the plain-text
 * version is always available for accessibility / spam-score / text-only readers.
 * Applicant-ID and conditional-selection emails are simpler (HTML + plain) too.
 *
 * <h2>Failure</h2>
 * Any {@link MailException} or {@link MessagingException} is wrapped in
 * {@link EmailDeliveryException} and re-thrown. The auth flows MUST catch and
 * surface a retryable error. Best-effort callers (post-verify applicant-id
 * notice, conditional-selection notice) catch + log on their own.
 *
 * <h2>From address</h2>
 * The {@code mailFrom} string must be an address the SMTP account is
 * authorized to send as — otherwise the provider rejects with 5.7.x. With
 * Gmail/Workspace app passwords that's usually the same address as
 * {@code SMTP_USERNAME}.
 */
@Slf4j
public class SmtpEmailProvider implements EmailProvider {

    private static final DateTimeFormatter EXPIRY_FORMAT =
            DateTimeFormatter.ofPattern("MMM d, yyyy 'at' h:mm a z")
                    .withZone(ZoneId.of("America/New_York"));

    private final JavaMailSender mailSender;
    private final String mailFrom;

    public SmtpEmailProvider(JavaMailSender mailSender, String mailFrom) {
        this.mailSender = mailSender;
        this.mailFrom = mailFrom;
    }

    @Override
    public void sendVerificationCode(String email, String code, Instant expiresAt) {
        String expiryLabel = expiresAt != null ? EXPIRY_FORMAT.format(expiresAt) : "soon";
        String plain = ""
                + "Welcome to Skyzen Careers.\n\n"
                + "Your verification code is: " + code + "\n\n"
                + "Enter this code on the verification screen to activate your account.\n"
                + "It expires " + expiryLabel + ".\n\n"
                + "If you didn't request this, you can safely ignore this email.\n\n"
                + "— The Skyzen Careers team\n";
        String html = wrapHtml(
                "Verify your email",
                "<p style=\"margin:0 0 12px;font-size:15px;color:#1f2937;\">"
                        + "Welcome to Skyzen Careers."
                        + "</p>"
                        + "<p style=\"margin:0 0 12px;font-size:15px;color:#1f2937;\">"
                        + "Your verification code is:"
                        + "</p>"
                        + "<div style=\"margin:18px 0;padding:14px 18px;border:1px solid #d1d5db;"
                        + "border-radius:8px;background:#f9fafb;font-family:monospace;"
                        + "font-size:28px;letter-spacing:6px;text-align:center;color:#111827;\">"
                        + escape(code)
                        + "</div>"
                        + "<p style=\"margin:0 0 12px;font-size:14px;color:#4b5563;\">"
                        + "Enter this code on the verification screen to activate your account. "
                        + "It expires " + escape(expiryLabel) + "."
                        + "</p>"
                        + "<p style=\"margin:16px 0 0;font-size:13px;color:#6b7280;\">"
                        + "If you didn't request this, you can safely ignore this email."
                        + "</p>"
        );
        send(email, "Your Skyzen verification code", plain, html);
    }

    @Override
    public void sendApplicantIdIssued(String email, String applicantId) {
        String plain = ""
                + "Your Skyzen Applicant ID has been issued.\n\n"
                + "Applicant ID: " + applicantId + "\n\n"
                + "Keep this for your records — recruiters reference it on every application.\n\n"
                + "— The Skyzen Careers team\n";
        String html = wrapHtml(
                "Your Skyzen Applicant ID",
                "<p style=\"margin:0 0 12px;font-size:15px;color:#1f2937;\">"
                        + "Your account is verified — welcome aboard."
                        + "</p>"
                        + "<p style=\"margin:0 0 8px;font-size:14px;color:#4b5563;\">"
                        + "Your Applicant ID:"
                        + "</p>"
                        + "<div style=\"margin:8px 0 18px;padding:12px 16px;border:1px solid #d1d5db;"
                        + "border-radius:8px;background:#f9fafb;font-family:monospace;"
                        + "font-size:18px;color:#111827;\">"
                        + escape(applicantId)
                        + "</div>"
                        + "<p style=\"margin:0;font-size:13px;color:#6b7280;\">"
                        + "Keep this for your records — recruiters reference it on every application."
                        + "</p>"
        );
        send(email, "Your Skyzen Applicant ID", plain, html);
    }

    @Override
    public void sendPasswordReset(String email, String resetUrl, Instant expiresAt) {
        String expiryLabel = expiresAt != null ? EXPIRY_FORMAT.format(expiresAt) : "in 1 hour";
        String plain = ""
                + "We received a request to reset your Skyzen Careers password.\n\n"
                + "Reset link: " + resetUrl + "\n\n"
                + "This link expires " + expiryLabel + ". If you didn't request this,\n"
                + "ignore this email and your password stays unchanged.\n\n"
                + "— The Skyzen Careers team\n";
        String html = wrapHtml(
                "Reset your password",
                "<p style=\"margin:0 0 12px;font-size:15px;color:#1f2937;\">"
                        + "We received a request to reset your Skyzen Careers password."
                        + "</p>"
                        + "<p style=\"margin:0 0 18px;\">"
                        + "<a href=\"" + escape(resetUrl) + "\" "
                        + "style=\"display:inline-block;padding:10px 18px;border-radius:6px;"
                        + "background:#1e40af;color:#ffffff;text-decoration:none;font-weight:600;"
                        + "font-size:14px;\">Reset password</a>"
                        + "</p>"
                        + "<p style=\"margin:0 0 12px;font-size:13px;color:#4b5563;word-break:break-all;\">"
                        + "Or paste this link into your browser:<br/>"
                        + "<span style=\"color:#1e40af;\">" + escape(resetUrl) + "</span>"
                        + "</p>"
                        + "<p style=\"margin:0 0 12px;font-size:13px;color:#4b5563;\">"
                        + "This link expires " + escape(expiryLabel) + "."
                        + "</p>"
                        + "<p style=\"margin:16px 0 0;font-size:13px;color:#6b7280;\">"
                        + "If you didn't request this, you can ignore this email and your password "
                        + "stays unchanged."
                        + "</p>"
        );
        send(email, "Reset your Skyzen Careers password", plain, html);
    }

    @Override
    public void sendConditionalSelectionConfirmation(String email,
                                                     String jobPostingTitle,
                                                     String entityName) {
        String role = jobPostingTitle != null ? jobPostingTitle : "the role";
        String at = entityName != null ? " at " + entityName : "";
        String plain = ""
                + "Great news — you've been conditionally selected for " + role + at + ".\n\n"
                + "Your formal offer letter and compliance steps will follow shortly.\n"
                + "We'll be in touch with next steps.\n\n"
                + "— The Skyzen Careers team\n";
        String html = wrapHtml(
                "You've been conditionally selected",
                "<p style=\"margin:0 0 12px;font-size:15px;color:#1f2937;\">"
                        + "Great news — you've been <strong>conditionally selected</strong> for "
                        + escape(role) + escape(at) + "."
                        + "</p>"
                        + "<p style=\"margin:0 0 12px;font-size:14px;color:#4b5563;\">"
                        + "Your formal offer letter and compliance steps will follow shortly. "
                        + "We'll be in touch with next steps."
                        + "</p>"
        );
        send(email, "You've been conditionally selected — Skyzen Careers", plain, html);
    }

    // ── Wire ────────────────────────────────────────────────────────────────

    private void send(String to, String subject, String plain, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(mailFrom);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(plain, html); // plain first, html second → multipart/alternative
            mailSender.send(message);
            log.info("Sent email '{}' to {}", subject, to);
        } catch (MailException | MessagingException e) {
            log.error("Email send failed — subject='{}' to={} : {}",
                    subject, to, e.getMessage());
            throw new EmailDeliveryException(
                    "Couldn't deliver email to " + to, e);
        }
    }

    private static String wrapHtml(String heading, String bodyHtml) {
        return "<!doctype html><html><body style=\"margin:0;padding:0;background:#f3f4f6;"
                + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"padding:24px 0;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;"
                + "max-width:560px;width:100%;\">"
                + "<tr><td style=\"padding:24px 28px;border-bottom:1px solid #e5e7eb;\">"
                + "<div style=\"font-size:18px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;\">"
                + "Skyzen <span style=\"color:#1e40af;\">Careers</span>"
                + "</div>"
                + "</td></tr>"
                + "<tr><td style=\"padding:24px 28px;\">"
                + "<h1 style=\"margin:0 0 16px;font-size:18px;color:#0f172a;\">"
                + escape(heading) + "</h1>"
                + bodyHtml
                + "</td></tr>"
                + "<tr><td style=\"padding:14px 28px 22px;border-top:1px solid #e5e7eb;"
                + "font-size:12px;color:#6b7280;\">"
                + "This is an automated message from Skyzen Careers. "
                + "Please don't reply directly to this email."
                + "</td></tr>"
                + "</table></td></tr></table></body></html>";
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
