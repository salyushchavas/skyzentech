package com.skyzen.careers.notification;

import lombok.extern.slf4j.Slf4j;

import java.time.Instant;

/**
 * Fallback {@link EmailProvider}. Logs at INFO and returns. Used in dev / CI /
 * local where SMTP isn't configured. Bean is created by
 * {@link EmailProviderConfiguration} only when no SMTP host is set.
 *
 * Never throws — these are still real call sites in tests/dev, and we don't
 * want a log statement to corrupt an auth flow.
 */
@Slf4j
public class LogEmailProvider implements EmailProvider {

    @Override
    public void sendVerificationCode(String email, String code, Instant expiresAt) {
        log.info("[LOG EMAIL] Verification code for {}: {} (expires {})",
                email, code, expiresAt);
    }

    @Override
    public void sendApplicantIdIssued(String email, String applicantId) {
        log.info("[LOG EMAIL] Applicant ID issued for {}: {}", email, applicantId);
    }

    @Override
    public void sendPasswordReset(String email, String resetUrl, Instant expiresAt) {
        log.info("[LOG EMAIL] Password reset for {}: {} (expires {})",
                email, resetUrl, expiresAt);
    }

    @Override
    public void sendConditionalSelectionConfirmation(String email,
                                                     String jobPostingTitle,
                                                     String entityName) {
        log.info("[LOG EMAIL] Conditional selection confirmed for {} — {}{}",
                email,
                jobPostingTitle != null ? jobPostingTitle : "(role)",
                entityName != null ? " @ " + entityName : "");
    }
}
