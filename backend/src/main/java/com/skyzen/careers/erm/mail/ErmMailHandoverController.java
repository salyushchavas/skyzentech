package com.skyzen.careers.erm.mail;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.intern.MailHandoverService;
import com.skyzen.careers.intern.MailHandoverService.AssignmentResult;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Mail bridge Phase 4 — ERM "Assign company email" endpoint. Triggers
 * the handover: company mailbox provisioning, user-row swap (email
 * swap + password retire + state → PENDING_ACTIVATION), welcome
 * message drop, and the AFTER_COMMIT credential email to the
 * intern's personal Gmail.
 *
 * <p>Same convention as the rest of the ERM surface:
 * {@code /api/v1/erm/...} prefix, gated by {@code hasAnyRole('ERM',
 * 'SUPER_ADMIN')}. Returns the assigned company address + a status —
 * NEVER the plaintext starting password (that goes out only via the
 * external credential email).</p>
 */
@RestController
@RequestMapping("/api/v1/erm/interns")
@RequiredArgsConstructor
public class ErmMailHandoverController {

    private final MailHandoverService mailHandoverService;

    @PostMapping("/{userId}/assign-company-email")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public AssignCompanyEmailResponse assign(@PathVariable UUID userId,
                                              @RequestBody AssignCompanyEmailRequest req,
                                              @AuthenticationPrincipal User caller) {
        AssignmentResult r = mailHandoverService.assignCompanyEmail(
                caller, userId, req.localPart(), req.startingPassword());
        return new AssignCompanyEmailResponse(
                r.userId(), r.companyEmail(), "PENDING_ACTIVATION");
    }

    /**
     * Request body for the assignment endpoint. {@code localPart} is the
     * local part of the new mailbox (e.g. {@code "asmith"} → mailbox
     * {@code asmith@skyzentech.com}); the seed domain is enforced
     * server-side. {@code startingPassword} is what the intern uses on
     * first sign-in to the mailbox; it lands in the show-once
     * credential email to their personal Gmail and is then retired the
     * moment they set a new password.
     */
    public record AssignCompanyEmailRequest(String localPart, String startingPassword) {}

    /**
     * Response shape. Note the absence of any plaintext — the starting
     * password is delivered exclusively via the credential email so it
     * never sits in any HTTP response, log line, or DTO field.
     */
    public record AssignCompanyEmailResponse(UUID userId, String companyEmail, String status) {}
}
