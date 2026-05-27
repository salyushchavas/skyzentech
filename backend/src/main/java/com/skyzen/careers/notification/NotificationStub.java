package com.skyzen.careers.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Facade around the wired {@link EmailProvider}. Owns the
 * {@code surface-stub} flag (a dev/staging-only convenience that echoes the
 * verification code in the HTTP response) and delegates the actual send to
 * the chosen provider — SMTP in production, log in dev / unconfigured envs.
 *
 * <h2>History</h2>
 * Previously a concrete log-only stub (decision D2: "real send NOT wired").
 * C3 inverts that: an {@link EmailProvider} interface is now selected by
 * {@link EmailProviderConfiguration} based on whether SMTP creds are
 * configured. This class survives as the facade because every call site is
 * already injecting it by name — renaming would be churn for no benefit, and
 * keeping the {@link #shouldSurfaceStub()} concern paired with the email
 * call sites makes the dev/prod toggle obvious.
 *
 * <h2>Failure semantics</h2>
 * This class passes {@link EmailDeliveryException} through unchanged.
 * Callers decide:
 * <ul>
 *   <li>Auth verification flows: catch + surface a retryable HTTP error
 *       (and let the @Transactional roll back).</li>
 *   <li>Post-verification "applicant ID issued" notice: best-effort —
 *       catching + logging keeps the verification successful.</li>
 *   <li>Password reset: best-effort — never reveal account existence.</li>
 *   <li>Recruiter conditional-selection: best-effort — selection itself is
 *       the source of truth.</li>
 * </ul>
 */
@Component
public class NotificationStub {

    private final EmailProvider emailProvider;
    private final boolean surfaceStubInResponse;

    public NotificationStub(EmailProvider emailProvider,
                            @Value("${app.notification.surface-stub:true}") boolean surfaceStub) {
        this.emailProvider = emailProvider;
        this.surfaceStubInResponse = surfaceStub;
    }

    public boolean shouldSurfaceStub() {
        return surfaceStubInResponse;
    }

    public void sendVerificationCode(String email, String code, Instant expiresAt) {
        emailProvider.sendVerificationCode(email, code, expiresAt);
    }

    public void sendApplicantIdIssued(String email, String applicantId) {
        emailProvider.sendApplicantIdIssued(email, applicantId);
    }

    public void sendPasswordReset(String email, String resetUrl, Instant expiresAt) {
        emailProvider.sendPasswordReset(email, resetUrl, expiresAt);
    }

    public void sendConditionalSelectionConfirmation(String email,
                                                     String jobPostingTitle,
                                                     String entityName) {
        emailProvider.sendConditionalSelectionConfirmation(email, jobPostingTitle, entityName);
    }
}
