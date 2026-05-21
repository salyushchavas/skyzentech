package com.skyzen.careers.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * One-and-only-one wrapper around outbound transactional emails. Real send is
 * NOT wired yet (decision D2). Every method logs at INFO and returns; in
 * non-prod the calling controller surfaces the same value in the HTTP response
 * so the flow is testable end-to-end without an SMTP server.
 *
 * When real SES/SendGrid integration lands later, swap the bodies here — the
 * call sites stay identical.
 */
@Component
@Slf4j
public class NotificationStub {

    /**
     * Whether stub values (verification codes, applicant IDs) should be echoed
     * in the HTTP response. Defaults TRUE so the dev/staging flow stays
     * testable; prod sets {@code app.notification.surface-stub=false}.
     */
    private final boolean surfaceStubInResponse;

    public NotificationStub(@Value("${app.notification.surface-stub:true}") boolean surfaceStub) {
        this.surfaceStubInResponse = surfaceStub;
    }

    public boolean shouldSurfaceStub() {
        return surfaceStubInResponse;
    }

    /** Stub for the post-registration verification email. */
    public void sendVerificationCode(String email, String code, Instant expiresAt) {
        log.info("[STUB EMAIL] Verification code for {}: {} (expires {})",
                email, code, expiresAt);
    }

    /** Stub for the post-verification "your Skyzen Applicant ID" notice. */
    public void sendApplicantIdIssued(String email, String applicantId) {
        log.info("[STUB EMAIL] Applicant ID issued for {}: {}", email, applicantId);
    }
}
