package com.skyzen.careers.listener;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.event.TimesheetApprovedEvent;
import com.skyzen.careers.event.TimesheetRejectedEvent;
import com.skyzen.careers.event.TimesheetSubmittedEvent;
import com.skyzen.careers.event.TimesheetVerifiedEvent;
import com.skyzen.careers.notification.UserNotificationDispatcher;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;
import java.util.UUID;

/**
 * Phase B2 — AFTER_COMMIT chain notifications across the two-stage
 * timesheet approval flow:
 *
 * <ul>
 *   <li>Intern submits → notify ERM(s) — owning {@code lifecycle.erm_id}
 *       when set, else broadcast to all users with the ERM role.</li>
 *   <li>ERM verifies → notify the owning {@code lifecycle.manager_id}.</li>
 *   <li>Manager approves → notify the intern.</li>
 *   <li>Reject (at either stage) → notify the intern with the reviewer
 *       reason. {@code previousStatus} tells us whether it was an ERM
 *       reject (from SUBMITTED) or a Manager reject (from VERIFIED) so
 *       the body copy reads naturally.</li>
 * </ul>
 *
 * <p>Best-effort: each dispatch is try/catch-wrapped; a notification
 * failure never rolls back the transition (which is already committed
 * by the AFTER_COMMIT phase).</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TimesheetChainListener {

    private final InternLifecycleRepository lifecycleRepository;
    private final UserRepository userRepository;
    private final UserNotificationDispatcher dispatcher;

    // ── Submitted → ERM ─────────────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSubmitted(TimesheetSubmittedEvent e) {
        if (e == null || e.getInternUserId() == null) return;
        try {
            String internName = nameOf(e.getInternUserId(), "An intern");
            InternLifecycle lc = lifecycleRepository.findByUserId(e.getInternUserId())
                    .orElse(null);
            List<UUID> recipients = ermRecipients(lc);
            if (recipients.isEmpty()) {
                log.debug("[TimesheetChain] no ERM resolvable for intern {} — submit notify skipped",
                        e.getInternUserId());
                return;
            }
            String title = internName + " submitted a timesheet";
            String body  = "Open ERM → Timesheets to verify the week.";
            for (UUID rid : recipients) {
                safeDispatch(rid, "TIMESHEET_SUBMITTED", e.getInternUserId(),
                        title, body, "/careers/erm/timesheets");
            }
        } catch (Exception ex) {
            log.warn("[TimesheetChain] onSubmitted failed (non-fatal): {}", ex.getMessage());
        }
    }

    // ── Verified → Manager ──────────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVerified(TimesheetVerifiedEvent e) {
        if (e == null || e.getInternUserId() == null) return;
        try {
            String internName = nameOf(e.getInternUserId(), "An intern");
            InternLifecycle lc = lifecycleRepository.findByUserId(e.getInternUserId())
                    .orElse(null);
            if (lc == null || lc.getManagerId() == null) {
                log.debug("[TimesheetChain] no manager on lifecycle for {} — verify notify skipped",
                        e.getInternUserId());
                return;
            }
            String title = internName + "'s timesheet is verified";
            String body  = "Ready for your approval in Manager → Timesheet Approvals.";
            safeDispatch(lc.getManagerId(), "TIMESHEET_VERIFIED", e.getInternUserId(),
                    title, body, "/careers/manager/timesheet-approvals");
        } catch (Exception ex) {
            log.warn("[TimesheetChain] onVerified failed (non-fatal): {}", ex.getMessage());
        }
    }

    // ── Approved → Intern ───────────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onApproved(TimesheetApprovedEvent e) {
        if (e == null || e.getInternUserId() == null) return;
        try {
            safeDispatch(e.getInternUserId(), "TIMESHEET_APPROVED", e.getInternUserId(),
                    "Your timesheet was approved",
                    "Your week has been approved and is now counted toward your total hours.",
                    "/careers/intern/timesheets");
        } catch (Exception ex) {
            log.warn("[TimesheetChain] onApproved failed (non-fatal): {}", ex.getMessage());
        }
    }

    // ── Rejected → Intern ───────────────────────────────────────────────────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRejected(TimesheetRejectedEvent e) {
        if (e == null || e.getInternUserId() == null) return;
        try {
            String stageLabel = "VERIFIED".equalsIgnoreCase(e.getPreviousStatus())
                    ? "Your manager" : "Your ERM";
            String reason = e.getReason() != null ? e.getReason() : "(no reason given)";
            String body = stageLabel + " sent your week back for correction. Reason: "
                    + truncate(reason, 200);
            safeDispatch(e.getInternUserId(), "TIMESHEET_REJECTED", e.getInternUserId(),
                    "Timesheet returned for correction", body,
                    "/careers/intern/timesheets");
        } catch (Exception ex) {
            log.warn("[TimesheetChain] onRejected failed (non-fatal): {}", ex.getMessage());
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private List<UUID> ermRecipients(InternLifecycle lc) {
        if (lc != null && lc.getErmId() != null) {
            return List.of(lc.getErmId());
        }
        // No per-intern ERM owner — broadcast to all active ERMs so the
        // week doesn't sit unclaimed.
        try {
            return userRepository.findByRole(UserRole.ERM).stream()
                    .filter(u -> u != null && u.getId() != null
                            && Boolean.TRUE.equals(u.getActive()))
                    .map(User::getId)
                    .toList();
        } catch (Exception e) {
            log.debug("[TimesheetChain] ERM role lookup failed (non-fatal): {}", e.getMessage());
            return List.of();
        }
    }

    private String nameOf(UUID userId, String fallback) {
        if (userId == null) return fallback;
        try {
            return userRepository.findById(userId)
                    .map(u -> u.getFullName() != null && !u.getFullName().isBlank()
                            ? u.getFullName() : fallback)
                    .orElse(fallback);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private void safeDispatch(UUID recipient, String eventType, UUID subject,
                              String title, String body, String actionUrl) {
        if (recipient == null) return;
        try {
            dispatcher.dispatch(recipient, eventType, subject, title, body, actionUrl, false);
        } catch (Exception e) {
            log.warn("[TimesheetChain] dispatch {} -> {} failed (non-fatal): {}",
                    eventType, recipient, e.getMessage());
        }
    }

    private static String truncate(String s, int n) {
        if (s == null) return "";
        return s.length() > n ? s.substring(0, n) + "…" : s;
    }
}
