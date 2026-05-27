package com.skyzen.careers.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Selects which {@link EmailProvider} implementation Spring wires:
 *
 * <ul>
 *   <li>Both {@code spring.mail.host} AND {@code spring.mail.username} present
 *       → {@link SmtpEmailProvider} (real send via JavaMailSender).</li>
 *   <li>Either missing → {@link LogEmailProvider} (fallback; logs at INFO).</li>
 * </ul>
 *
 * The decision happens at bean-construction time so {@code @Autowired
 * EmailProvider} resolves to exactly one bean. JavaMailSender is itself
 * auto-configured by Spring Boot from {@code spring.mail.*}; we only need to
 * read those values to know whether SMTP is "live".
 *
 * <h2>Env vars</h2>
 * <ul>
 *   <li>{@code SMTP_HOST} → {@code spring.mail.host}</li>
 *   <li>{@code SMTP_PORT} → {@code spring.mail.port} (default 587 STARTTLS)</li>
 *   <li>{@code SMTP_USERNAME} → {@code spring.mail.username}</li>
 *   <li>{@code SMTP_PASSWORD} → {@code spring.mail.password}</li>
 *   <li>{@code MAIL_FROM} → the From: header on every outgoing message</li>
 *   <li>{@code SMTP_STARTTLS} (default {@code true})</li>
 *   <li>{@code SMTP_SSL} (default {@code false})</li>
 * </ul>
 */
@Configuration
@Slf4j
public class EmailProviderConfiguration {

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.mail.from:noreply@skyzentech.com}")
    private String mailFrom;

    @Bean
    public EmailProvider emailProvider(JavaMailSender mailSender) {
        if (isBlank(mailHost) || isBlank(mailUsername)) {
            log.warn("SMTP not configured (spring.mail.host / spring.mail.username missing) — "
                    + "falling back to LogEmailProvider. Emails will be logged, not sent. "
                    + "Set SMTP_HOST + SMTP_USERNAME + SMTP_PASSWORD + MAIL_FROM to enable real send.");
            return new LogEmailProvider();
        }
        log.info("SMTP configured — using SmtpEmailProvider (host={}, from={})",
                mailHost, mailFrom);
        return new SmtpEmailProvider(mailSender, mailFrom);
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
