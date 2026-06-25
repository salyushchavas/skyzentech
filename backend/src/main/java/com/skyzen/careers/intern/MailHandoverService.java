package com.skyzen.careers.intern;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.MailHandoverState;
import com.skyzen.careers.event.CompanyEmailAssignedEvent;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.mail.dto.MailCredentialResponse;
import com.skyzen.careers.mail.service.MailAdminService;
import com.skyzen.careers.mail.service.MailMessageService;
import com.skyzen.careers.notification.UserNotificationDispatcher;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Mail bridge Phase 4 — ERM-driven handover from PERSONAL email to a
 * company mailbox. Triggers the Phases 2 + 3 bridges for this user.
 *
 * <h2>What one call does, atomically</h2>
 * <ol>
 *   <li>Provisions a new company mailbox on the seed domain via
 *       {@link MailAdminService#provisionMailboxInternal} (joins the
 *       same transaction — a rollback unwinds the mailbox row too).</li>
 *   <li>Mutates the user row in exactly this order, in one save:
 *       {@code personalEmail = <current email>},
 *       {@code mailAccountId = <new account id>},
 *       {@code email = <company address>},
 *       {@code passwordHash = null} (retires the personal password —
 *         otherwise it would still authenticate against the new identity),
 *       {@code mailHandoverState = PENDING_ACTIVATION},
 *       {@code mailHandoverAt = now()}.</li>
 *   <li>Drops a welcome message into the new mailbox via
 *       {@link MailMessageService#deliverInternalNotification} (FROM
 *       {@code noreply@<seed-domain>}). The mailbox was created earlier
 *       in this same transaction, so the same-domain wall resolves it.</li>
 *   <li>Publishes a {@link CompanyEmailAssignedEvent} carrying the
 *       show-once starting password (in-memory only; never persisted)
 *       so {@code CompanyEmailAssignedListener} can send THE LAST
 *       external email — to {@code personalEmail} via the RAW
 *       provider, AFTER_COMMIT.</li>
 * </ol>
 *
 * <h2>Guards</h2>
 * <ul>
 *   <li>Target must exist.</li>
 *   <li>Target must have an {@code employeeId} (i.e. have reached
 *       {@code EMPLOYEE_ID_CREATED} or later). Phase-2 handover before
 *       that point is meaningless.</li>
 *   <li>Idempotency: proceeds ONLY if
 *       {@code mailHandoverState == PERSONAL} AND
 *       {@code mailAccountId == null}. Any other state is a clean
 *       {@link ConflictException} so the ERM can't double-provision or
 *       re-swap.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MailHandoverService {

    private final UserRepository userRepository;
    private final MailAdminService mailAdminService;
    private final MailMessageService mailMessageService;
    private final UserNotificationDispatcher userNotificationDispatcher;
    private final ApplicationEventPublisher eventPublisher;

    /** Same key {@code MailAdminSeeder} + {@code MailRoleAccountSeeder} use. */
    @Value("${app.webmail.seed.admin-domain:skyzentech.com}")
    private String seedDomain;

    /**
     * Sender role for the welcome-message drop. ERM owns the handover
     * action, so {@code erm@} is the correct stamp.
     */
    private static final String WELCOME_SENDER_LOCAL_PART = "erm";

    /** Outcome surfaced back to the ERM controller. Carries no plaintext. */
    public record AssignmentResult(UUID userId, UUID mailAccountId, String companyEmail) {}

    @Transactional
    public AssignmentResult assignCompanyEmail(User caller, UUID targetUserId,
                                                String localPartIn, String startingPassword) {
        if (targetUserId == null) {
            throw new BadRequestException("targetUserId is required");
        }
        if (localPartIn == null || localPartIn.isBlank()) {
            throw new BadRequestException("localPart is required");
        }
        if (startingPassword == null || startingPassword.isBlank()) {
            throw new BadRequestException("startingPassword is required");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found: " + targetUserId));

        // Lifecycle gate: only handover an employee. employee_id is stamped at
        // EMPLOYEE_ID_CREATED by OfferIdmsSigningService and is never cleared.
        if (target.getEmployeeId() == null || target.getEmployeeId().isBlank()) {
            throw new ConflictException(
                    "User has no employee_id yet — handover is only valid from "
                            + "EMPLOYEE_ID_CREATED onwards.");
        }

        // Idempotency: refuse to double-provision or re-swap.
        if (target.getMailHandoverState() != MailHandoverState.PERSONAL
                || target.getMailAccountId() != null) {
            throw new ConflictException(
                    "User already has a company mailbox assigned "
                            + "(state=" + target.getMailHandoverState() + ", "
                            + "mailAccountId=" + target.getMailAccountId() + ").");
        }

        String personalEmail = target.getEmail();
        if (personalEmail == null || personalEmail.isBlank()) {
            // Defensive — every users row has a NOT-NULL email today; this
            // catches the case where something has scrubbed it.
            throw new ConflictException("Target user has no current email to archive.");
        }

        String displayName = target.getFullName() != null && !target.getFullName().isBlank()
                ? target.getFullName()
                : (target.getEmployeeId() != null ? target.getEmployeeId() : "Skyzen Employee");

        // Provision the mailbox (joins this transaction — rollback safe).
        MailCredentialResponse cred = mailAdminService.provisionMailboxInternal(
                seedDomain,
                localPartIn.trim().toLowerCase(java.util.Locale.ROOT),
                displayName,
                startingPassword,
                /* requireChangeOnFirstLogin */ true);

        String companyEmail = cred.email();
        UUID mailAccountId = UUID.fromString(cred.accountId());

        // Phase 5 (revised) — NOTIFY-ONLY handover. We link the mailbox
        // and archive the personal email so the credential email knows
        // where to send, but we DO NOT swap users.email and DO NOT
        // null users.password_hash. The dashboard login remains
        // byte-identical for this user; the mailbox is purely a
        // notification inbox reached via /mail with the mail
        // credentials. State goes straight to ACTIVATED so the Phase-2
        // BridgingEmailProvider routes notifications internally from
        // this moment (no intermediate PENDING_ACTIVATION window).
        target.setPersonalEmail(personalEmail);
        target.setMailAccountId(mailAccountId);
        target.setMailHandoverState(MailHandoverState.ACTIVATED);
        target.setMailHandoverAt(Instant.now());
        userRepository.save(target);

        // Drop the welcome message into the new mailbox.
        try {
            mailMessageService.deliverInternalNotification(
                    WELCOME_SENDER_LOCAL_PART + "@" + seedDomain,
                    companyEmail,
                    "Welcome to your Skyzen company mailbox",
                    welcomeBody(displayName, companyEmail),
                    welcomeBodyHtml(displayName, companyEmail));
        } catch (Exception e) {
            // The welcome message is a courtesy — don't roll back the whole
            // handover for a mail-write hiccup. The mailbox + credentials
            // are still valid and the user can sign in.
            log.warn("[MailHandover] welcome-message drop failed for {} (non-fatal): {}",
                    companyEmail, e.getMessage());
        }

        // Phase 5 (revised) — one-time in-dashboard notice. Reuses the
        // existing in-app notification mechanism the bell renders, so
        // the intern sees the announcement next time they open the
        // dashboard (no email needed for this surface).
        try {
            userNotificationDispatcher.dispatch(
                    target.getId(),
                    "COMPANY_MAILBOX_ASSIGNED",
                    caller != null ? caller.getId() : null,
                    "Your company mailbox is live",
                    "Skyzen notifications will now arrive in your internal "
                            + "mailbox at " + companyEmail + ". Open it from the "
                            + "mail icon next to your profile, or sign in directly "
                            + "at /mail.",
                    "/mail/login",
                    /* emailSent */ false);
        } catch (Exception e) {
            // Best-effort — never fail the assign for an in-app row write hiccup.
            log.warn("[MailHandover] in-app notice dispatch failed (non-fatal) for {}: {}",
                    target.getId(), e.getMessage());
        }

        // Fire the AFTER_COMMIT event so the credential email goes out only
        // if the surrounding transaction actually commits.
        eventPublisher.publishEvent(new CompanyEmailAssignedEvent(
                target.getId(), mailAccountId, personalEmail, companyEmail, cred.oneTimePassword()));

        log.info("[MailHandover] assigned company email {} to user {} "
                        + "(by={}, personalEmail archived)",
                companyEmail, target.getId(),
                caller != null ? caller.getId() : null);

        return new AssignmentResult(target.getId(), mailAccountId, companyEmail);
    }

    private static String welcomeBody(String displayName, String companyEmail) {
        return "Hi " + displayName + ",\n\n"
                + "This is your Skyzen company mailbox (" + companyEmail + "). "
                + "From now on, all Skyzen notifications — onboarding, project "
                + "updates, evaluations, reminders — will land here instead of "
                + "your personal Gmail.\n\n"
                + "Look for the starting credentials email at your personal "
                + "Gmail; once you change your password here, the same "
                + "credentials will also sign you into the Skyzen dashboard.\n\n"
                + "— Skyzen ERM";
    }

    private static String welcomeBodyHtml(String displayName, String companyEmail) {
        return "<p>Hi " + escapeHtml(displayName) + ",</p>"
                + "<p>This is your <strong>Skyzen company mailbox</strong> "
                + "(<code>" + escapeHtml(companyEmail) + "</code>). From now "
                + "on, all Skyzen notifications — onboarding, project updates, "
                + "evaluations, reminders — will land here instead of your "
                + "personal Gmail.</p>"
                + "<p>Look for the starting credentials email at your personal "
                + "Gmail; once you change your password here, the same "
                + "credentials will also sign you into the Skyzen dashboard.</p>"
                + "<p>— Skyzen ERM</p>";
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
