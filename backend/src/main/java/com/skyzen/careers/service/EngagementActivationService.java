package com.skyzen.careers.service;

import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.repository.EngagementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Hybrid activation helper for the {@code PENDING_COMPLIANCE → READY_TO_START}
 * transition.
 *
 * <p>Live HR flow uses {@link EngagementController}'s
 * {@code POST /api/v1/engagements/{id}/mark-ready} → {@link EngagementService#markReady},
 * which gates on {@link ComplianceRoutingService#requirementsSatisfied} and
 * stamps the audit action {@code MARK_READY}. This helper is the
 * <em>system-actor</em> counterpart used by the one-off
 * {@code UnstickOnboardingRunner} backfill for engagements that landed in
 * {@code PENDING_COMPLIANCE} before HR's "Activate" button existed.</p>
 *
 * <p><b>NOT</b> called from any compliance write path — an earlier
 * auto-advance design wired this into {@code I9FormService} /
 * {@code EVerifyService} / {@code I983Service} / {@code OnboardingService}
 * and produced a Spring circular dependency
 * ({@code compliance → activator → compliance}). Compliance writes flip
 * their own state and stop. HR clicks "Activate Engagement" (or the
 * recovery runner sweeps) to flip the engagement.</p>
 *
 * <h2>Idempotency</h2>
 * <ul>
 *   <li>Returns silently when the engagement isn't in
 *       {@code PENDING_COMPLIANCE} (handles late re-fires, double-runs).</li>
 *   <li>Returns silently when {@link ComplianceRoutingService#requirementsSatisfied}
 *       is false.</li>
 *   <li>The underlying {@link EngagementService#transitionToSystem}
 *       same-state check is itself idempotent.</li>
 * </ul>
 *
 * <h2>REQUIRES_NEW</h2>
 * The advance commits in its own short transaction so a failure here can
 * never roll back the caller (a runner sweeping many rows, or HR's
 * "Activate" flow if it ever delegates here).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementActivationService {

    private final EngagementRepository engagementRepository;
    private final EngagementService engagementService;
    private final ComplianceRoutingService complianceRoutingService;
    private final com.skyzen.careers.notification.NotificationService notificationService;

    /**
     * Looks at the candidate's active engagement and advances it to
     * READY_TO_START iff all compliance is done. Safe to call from anywhere;
     * never throws.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void tryAdvanceForCandidate(UUID candidateId) {
        if (candidateId == null) return;
        try {
            Engagement engagement = engagementService
                    .resolveActiveForCandidate(candidateId)
                    .orElse(null);
            tryAdvance(engagement, "ACTIVATION_AUTO");
        } catch (Exception e) {
            log.warn("Activation lookup failed for candidate {} (non-fatal): {}",
                    candidateId, e.getMessage(), e);
        }
    }

    /**
     * Direct path when the caller already has the engagement in hand.
     * Caller supplies the audit-action string so the source of the advance
     * (recovery backfill, future automation) is preserved in the audit row.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void tryAdvance(Engagement engagement, String auditAction) {
        if (engagement == null) return;
        try {
            if (engagement.getStatus() != EngagementStatus.PENDING_COMPLIANCE) {
                return; // Already past the gate (or in a terminal state).
            }
            if (!complianceRoutingService.requirementsSatisfied(engagement)) {
                return; // Some compliance item is still pending.
            }
            Engagement managed = engagementRepository.findById(engagement.getId())
                    .orElse(null);
            if (managed == null) return;
            if (managed.getStatus() != EngagementStatus.PENDING_COMPLIANCE) return;

            engagementService.transitionToSystem(
                    managed,
                    EngagementStatus.READY_TO_START,
                    auditAction,
                    null);
            log.info("Engagement {} advanced PENDING_COMPLIANCE → READY_TO_START "
                    + "(action={})", managed.getId(), auditAction);

            try {
                notificationService.sendOnboardingWelcome(managed);
            } catch (Exception e) {
                log.warn("Welcome notify failed (non-fatal) for {}: {}",
                        managed.getId(), e.getMessage());
            }
        } catch (Exception e) {
            log.warn("Activation for engagement {} failed (non-fatal): {}",
                    engagement.getId(), e.getMessage(), e);
        }
    }
}
