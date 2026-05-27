package com.skyzen.careers.notification;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.io.UnsupportedEncodingException;
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
 * <h2>Branded shared template</h2>
 * Every outgoing mail renders through {@link #wrapHtml(String, String)} —
 * the same logo header, brand colors, content card, and footer. Adding a new
 * email type is "build the body fragment, call {@code wrapHtml}". Colors
 * come from the frontend's tailwind palette (Skyzen orange accent on the
 * dark navy header) — see {@code frontend/tailwind.config.ts}.
 *
 * <h2>From header</h2>
 * {@code MimeMessageHelper.setFrom(address, personalName)} so the recipient's
 * inbox shows "Skyzen Tech" (configurable via {@code MAIL_FROM_NAME}) not the
 * raw address. The address must be one the SMTP account is authorized to
 * send as.
 *
 * <h2>Multipart</h2>
 * Sent as multipart/alternative — plain text first, HTML second — so mobile
 * mail clients render the branded version while accessibility tools / spam
 * scoring see the plain version.
 *
 * <h2>Failure</h2>
 * Any {@link MailException} / {@link MessagingException} / encoding error is
 * wrapped in {@link EmailDeliveryException}. Auth flows MUST catch and
 * surface a retryable error; best-effort callers (applicant-ID notice,
 * password-reset, conditional-selection) catch + log on their own.
 */
@Slf4j
public class SmtpEmailProvider implements EmailProvider {

    private static final DateTimeFormatter EXPIRY_FORMAT =
            DateTimeFormatter.ofPattern("MMM d, yyyy 'at' h:mm a z")
                    .withZone(ZoneId.of("America/New_York"));

    // Brand tokens — mirror frontend/tailwind.config.ts so the email is
    // visually continuous with the rest of the product.
    private static final String COLOR_HEADER_BG    = "#080d1a"; // skyzen.dark
    private static final String COLOR_HEADER_TEXT  = "#ffffff";
    private static final String COLOR_ACCENT_FROM  = "#fb9b47"; // accent.DEFAULT
    private static final String COLOR_ACCENT_TO    = "#ff7c20"; // accent.dark
    private static final String COLOR_BODY_BG      = "#f3f4f6";
    private static final String COLOR_CARD_BG      = "#ffffff";
    private static final String COLOR_CARD_BORDER  = "#e5e7eb";
    private static final String COLOR_TEXT_PRIMARY = "#0f172a";
    private static final String COLOR_TEXT_BODY    = "#1f2937";
    private static final String COLOR_TEXT_MUTED   = "#6b7280";
    private static final String COLOR_TEXT_HINT    = "#4b5563";
    private static final String COLOR_CODE_BG      = "#fff5ec"; // primary.50
    private static final String COLOR_CODE_BORDER  = "#ffcc9e"; // primary.200

    private final JavaMailSender mailSender;
    private final String mailFromAddress;
    private final String mailFromName;
    private final String logoUrl;
    private final String brandUrl;

    public SmtpEmailProvider(JavaMailSender mailSender,
                             String mailFromAddress,
                             String mailFromName,
                             String logoUrl,
                             String brandUrl) {
        this.mailSender = mailSender;
        this.mailFromAddress = mailFromAddress;
        this.mailFromName = mailFromName;
        this.logoUrl = logoUrl;
        this.brandUrl = brandUrl;
    }

    @Override
    public void sendVerificationCode(String email, String code, Instant expiresAt) {
        String expiryLabel = expiresAt != null ? EXPIRY_FORMAT.format(expiresAt) : "soon";
        String plain = ""
                + "Welcome to Skyzen Tech Careers.\n\n"
                + "Your verification code is: " + code + "\n\n"
                + "Enter this code on the verification screen to activate your account.\n"
                + "It expires " + expiryLabel + ".\n\n"
                + "If you didn't request this, you can safely ignore this email.\n\n"
                + "— The Skyzen Tech team\n";
        String html = wrapHtml(
                "Verify your email",
                "<p style=\"margin:0 0 12px;font-size:15px;color:" + COLOR_TEXT_BODY + ";\">"
                        + "Welcome to <strong>Skyzen Tech Careers</strong>."
                        + "</p>"
                        + "<p style=\"margin:0 0 8px;font-size:15px;color:" + COLOR_TEXT_BODY + ";\">"
                        + "Your verification code is:"
                        + "</p>"
                        + codeBlock(code)
                        + "<p style=\"margin:0 0 12px;font-size:14px;color:" + COLOR_TEXT_HINT + ";\">"
                        + "Enter this code on the verification screen to activate your account. "
                        + "It expires " + escape(expiryLabel) + "."
                        + "</p>"
                        + "<p style=\"margin:16px 0 0;font-size:13px;color:" + COLOR_TEXT_MUTED + ";\">"
                        + "If you didn't request this, you can safely ignore this email."
                        + "</p>"
        );
        send(email, "Your Skyzen Tech verification code", plain, html);
    }

    @Override
    public void sendApplicantIdIssued(String email, String applicantId) {
        String plain = ""
                + "Your Skyzen Applicant ID has been issued.\n\n"
                + "Applicant ID: " + applicantId + "\n\n"
                + "Keep this for your records — recruiters reference it on every application.\n\n"
                + "— The Skyzen Tech team\n";
        String html = wrapHtml(
                "Your Skyzen Applicant ID",
                "<p style=\"margin:0 0 12px;font-size:15px;color:" + COLOR_TEXT_BODY + ";\">"
                        + "Your account is verified — welcome aboard."
                        + "</p>"
                        + "<p style=\"margin:0 0 8px;font-size:14px;color:" + COLOR_TEXT_HINT + ";\">"
                        + "Your Applicant ID:"
                        + "</p>"
                        + "<div style=\"margin:8px 0 18px;padding:12px 16px;border:1px solid "
                        + COLOR_CARD_BORDER + ";border-radius:8px;background:#f9fafb;"
                        + "font-family:'SFMono-Regular',Consolas,monospace;"
                        + "font-size:18px;color:" + COLOR_TEXT_PRIMARY + ";\">"
                        + escape(applicantId)
                        + "</div>"
                        + "<p style=\"margin:0;font-size:13px;color:" + COLOR_TEXT_MUTED + ";\">"
                        + "Keep this for your records — recruiters reference it on every application."
                        + "</p>"
        );
        send(email, "Your Skyzen Applicant ID", plain, html);
    }

    @Override
    public void sendPasswordReset(String email, String resetUrl, Instant expiresAt) {
        String expiryLabel = expiresAt != null ? EXPIRY_FORMAT.format(expiresAt) : "in 1 hour";
        String plain = ""
                + "We received a request to reset your Skyzen Tech Careers password.\n\n"
                + "Reset link: " + resetUrl + "\n\n"
                + "This link expires " + expiryLabel + ". If you didn't request this,\n"
                + "ignore this email and your password stays unchanged.\n\n"
                + "— The Skyzen Tech team\n";
        String html = wrapHtml(
                "Reset your password",
                "<p style=\"margin:0 0 12px;font-size:15px;color:" + COLOR_TEXT_BODY + ";\">"
                        + "We received a request to reset your Skyzen Tech Careers password."
                        + "</p>"
                        + buttonBlock("Reset password", resetUrl)
                        + "<p style=\"margin:0 0 12px;font-size:13px;color:" + COLOR_TEXT_HINT + ";"
                        + "word-break:break-all;\">"
                        + "Or paste this link into your browser:<br/>"
                        + "<span style=\"color:" + COLOR_ACCENT_TO + ";\">" + escape(resetUrl) + "</span>"
                        + "</p>"
                        + "<p style=\"margin:0 0 12px;font-size:13px;color:" + COLOR_TEXT_HINT + ";\">"
                        + "This link expires " + escape(expiryLabel) + "."
                        + "</p>"
                        + "<p style=\"margin:16px 0 0;font-size:13px;color:" + COLOR_TEXT_MUTED + ";\">"
                        + "If you didn't request this, you can ignore this email and your password "
                        + "stays unchanged."
                        + "</p>"
        );
        send(email, "Reset your Skyzen Tech Careers password", plain, html);
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
                + "— The Skyzen Tech team\n";
        String html = wrapHtml(
                "You've been conditionally selected",
                "<p style=\"margin:0 0 12px;font-size:15px;color:" + COLOR_TEXT_BODY + ";\">"
                        + "Great news — you've been <strong>conditionally selected</strong> for "
                        + escape(role) + escape(at) + "."
                        + "</p>"
                        + "<p style=\"margin:0 0 12px;font-size:14px;color:" + COLOR_TEXT_HINT + ";\">"
                        + "Your formal offer letter and compliance steps will follow shortly. "
                        + "We'll be in touch with next steps."
                        + "</p>"
        );
        send(email, "You've been conditionally selected — Skyzen Tech", plain, html);
    }

    // ── Wire ────────────────────────────────────────────────────────────────

    private void send(String to, String subject, String plain, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(mailFromAddress, mailFromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(plain, html); // plain first, html second → multipart/alternative
            mailSender.send(message);
            log.info("Sent email '{}' to {}", subject, to);
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            log.error("Email send failed — subject='{}' to={} : {}",
                    subject, to, e.getMessage());
            throw new EmailDeliveryException(
                    "Couldn't deliver email to " + to, e);
        }
    }

    // ── Shared base template ────────────────────────────────────────────────

    /**
     * Branded outer template every email body is wrapped in. Logo header with
     * the dark navy brand bar, white content card, accent footer band, and
     * a muted disclaimer line. The body fragment is dropped inside the card.
     */
    private String wrapHtml(String heading, String bodyHtml) {
        return "<!doctype html><html><body style=\"margin:0;padding:0;background:" + COLOR_BODY_BG + ";"
                + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',"
                + "Arial,sans-serif;color:" + COLOR_TEXT_PRIMARY + ";\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"background:" + COLOR_BODY_BG + ";padding:24px 0;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"560\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"max-width:560px;width:100%;background:" + COLOR_CARD_BG + ";"
                + "border:1px solid " + COLOR_CARD_BORDER + ";border-radius:12px;overflow:hidden;\">"
                // Header — dark navy bar with logo
                + "<tr><td style=\"background:" + COLOR_HEADER_BG + ";padding:20px 28px;\">"
                + "<a href=\"" + escape(brandUrl) + "\" "
                + "style=\"display:inline-block;text-decoration:none;color:" + COLOR_HEADER_TEXT + ";\">"
                + "<img src=\"" + escape(logoUrl) + "\" alt=\"Skyzen Tech\" "
                + "height=\"32\" width=\"32\" "
                + "style=\"vertical-align:middle;border:0;display:inline-block;height:32px;width:auto;"
                + "margin-right:10px;\"/>"
                + "<span style=\"vertical-align:middle;font-size:18px;font-weight:700;"
                + "letter-spacing:-0.01em;color:" + COLOR_HEADER_TEXT + ";\">"
                + "Skyzen "
                + "<span style=\"background:linear-gradient(135deg," + COLOR_ACCENT_FROM + " 0%,"
                + COLOR_ACCENT_TO + " 100%);"
                + "-webkit-background-clip:text;background-clip:text;color:" + COLOR_ACCENT_FROM + ";"
                + "-webkit-text-fill-color:transparent;\">Tech</span>"
                + "</span>"
                + "</a>"
                + "</td></tr>"
                // Accent strip below header
                + "<tr><td style=\"background:linear-gradient(90deg," + COLOR_ACCENT_FROM + " 0%,"
                + COLOR_ACCENT_TO + " 100%);height:3px;line-height:3px;font-size:0;\">&nbsp;</td></tr>"
                // Content card
                + "<tr><td style=\"padding:28px;\">"
                + "<h1 style=\"margin:0 0 18px;font-size:20px;line-height:1.3;font-weight:700;"
                + "color:" + COLOR_TEXT_PRIMARY + ";letter-spacing:-0.01em;\">"
                + escape(heading) + "</h1>"
                + bodyHtml
                + "</td></tr>"
                // Footer disclaimer
                + "<tr><td style=\"padding:16px 28px 22px;border-top:1px solid " + COLOR_CARD_BORDER + ";"
                + "background:#fafbfc;font-size:12px;color:" + COLOR_TEXT_MUTED + ";\">"
                + "This is an automated message from Skyzen Tech Careers. Please don't reply directly "
                + "to this email — replies are not monitored.<br/>"
                + "<a href=\"" + escape(brandUrl) + "\" style=\"color:" + COLOR_ACCENT_TO + ";"
                + "text-decoration:none;font-weight:600;\">skyzentech.com</a>"
                + "</td></tr>"
                + "</table></td></tr></table></body></html>";
    }

    /** Verification-code emphasis block (large, monospaced, accent border). */
    private String codeBlock(String code) {
        return "<div style=\"margin:14px 0 18px;padding:16px 18px;border:1px solid "
                + COLOR_CODE_BORDER + ";border-radius:8px;background:" + COLOR_CODE_BG + ";"
                + "font-family:'SFMono-Regular',Consolas,monospace;"
                + "font-size:28px;letter-spacing:8px;text-align:center;font-weight:700;"
                + "color:" + COLOR_TEXT_PRIMARY + ";\">"
                + escape(code)
                + "</div>";
    }

    /** Accent CTA button (used by password reset). */
    private String buttonBlock(String label, String href) {
        return "<p style=\"margin:0 0 18px;\">"
                + "<a href=\"" + escape(href) + "\" "
                + "style=\"display:inline-block;padding:12px 22px;border-radius:8px;"
                + "background:linear-gradient(135deg," + COLOR_ACCENT_FROM + " 0%,"
                + COLOR_ACCENT_TO + " 100%);"
                + "color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;"
                + "letter-spacing:0.01em;\">"
                + escape(label)
                + "</a>"
                + "</p>";
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
