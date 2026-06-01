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
 * Auto-advances an engagement {@code PENDING_COMPLIANCE → READY_TO_START}
 * the moment every compliance requirement is satisfied. Closes the gap
 * where HR previously had to click a "Mark Ready" button after the last
 * compliance item flipped — without this trigger an engagement could sit
 * in PENDING_COMPLIANCE indefinitely even when I-9, I-983, E-Verify, and
 * the CPT task were all in their done-state.
 *
 * <h2>Where this is called from</h2>
 * The tail of every compliance state-change service method (I-9 Section 2
 * submit, E-Verify status update / close, I-983 DSO response, onboarding
 * task complete). Each caller wraps its invocation in try/catch so an
 * advance failure NEVER rolls back the underlying compliance write.
 *
 * <h2>Idempotency</h2>
 * - Returns silently when the engagement isn't in PENDING_COMPLIANCE
 *   (handles late events, double-fires, races).
 * - Returns silently when {@link ComplianceRoutingService#requirementsSatisfied}
 *   is false (some other item is still pending).
 * - The underlying {@code transitionToSystem} same-state check is itself
 *   idempotent.
 *
 * <h2>Why a separate REQUIRES_NEW transaction</h2>
 * The advance commits in its own short transaction so it doesn't entangle
 * with the calling compliance write — an audit row + status flip succeed
 * or fail independently of whatever else the caller is doing. Combined
 * with the caller-side try/catch this gives the strongest possible
 * "compliance writes never break because we tried to auto-advance"
 * guarantee.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementAutoAdvancer {

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
            tryAdvance(engagement);
        } catch (Exception e) {
            log.warn("Auto-advance lookup failed for candidate {} (non-fatal): {}",
                    candidateId, e.getMessage(), e);
        }
    }

    /**
     * Direct path when the caller already has the engagement in hand. Same
     * guarantees as {@link #tryAdvanceForCandidate}.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void tryAdvance(Engagement engagement) {
        if (engagement == null) return;
        try {
            if (engagement.getStatus() != EngagementStatus.PENDING_COMPLIANCE) {
                return; // Already past the gate (or in a terminal state).
            }
            if (!complianceRoutingService.requirementsSatisfied(engagement)) {
                return; // Some compliance item is still pending.
            }
            // Reload inside this REQUIRES_NEW transaction so the save touches
            // a managed entity in the right persistence context.
            Engagement managed = engagementRepository.findById(engagement.getId())
                    .orElse(null);
            if (managed == null) return;
            if (managed.getStatus() != EngagementStatus.PENDING_COMPLIANCE) return;

            engagementService.transitionToSystem(
                    managed,
                    EngagementStatus.READY_TO_START,
                    "AUTO_MARK_READY_COMPLIANCE_SATISFIED",
                    null);
            log.info("Engagement {} auto-advanced PENDING_COMPLIANCE → READY_TO_START "
                    + "(all compliance items satisfied)", managed.getId());

            // Best-effort "welcome aboard" notification. Failures here MUST
            // NOT roll back the transition — the welcome email is a nice-to-
            // have, the status flip is the important bit.
            try {
                notificationService.sendOnboardingWelcome(managed);
            } catch (Exception e) {
                log.warn("Welcome notify failed (non-fatal) after auto-advance for {}: {}",
                        managed.getId(), e.getMessage());
            }
        } catch (Exception e) {
            log.warn("Auto-advance for engagement {} failed (non-fatal): {}",
                    engagement.getId(), e.getMessage(), e);
        }
    }
}
