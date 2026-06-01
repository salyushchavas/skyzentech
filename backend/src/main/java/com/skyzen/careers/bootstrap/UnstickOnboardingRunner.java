package com.skyzen.careers.bootstrap;

import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.service.ComplianceRoutingService;
import com.skyzen.careers.service.EngagementActivationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * One-off recovery backfill that unsticks engagements sitting in
 * {@code PENDING_COMPLIANCE} even though every compliance item is already
 * in its done-state. These rows exist because there was a window where no
 * HR-facing "Activate Engagement" affordance existed yet, so HR had no
 * way to flip the gate even though the candidate had finished everything.
 *
 * <p>Idempotent + gated by {@code app.backfill.unstuck-onboarding-enabled=true}
 * (env {@code BACKFILL_UNSTUCK_ONBOARDING}). Default false. Operator flips
 * it on, redeploys once to sweep, then flips it back off. Safe to re-run.</p>
 *
 * <p>This is <b>recovery, not policy</b>. The live flow is:
 * compliance flips → HR sees "Activate Engagement" on the queue (driven by
 * {@code GET /api/v1/engagements/{id}/activation-readiness}) → HR clicks
 * → {@code POST /api/v1/engagements/{id}/mark-ready}. Nothing auto-flips
 * on a compliance write.</p>
 *
 * <p>Each row is delegated to
 * {@link EngagementActivationService#tryAdvance(Engagement, String)} with
 * the audit-action string {@code RECOVERY_BACKFILL_UNSTICK} so the audit
 * trail records exactly which path advanced the row.</p>
 */
@Component
@Order(20)
@Slf4j
public class UnstickOnboardingRunner implements CommandLineRunner {

    private static final String AUDIT_ACTION = "RECOVERY_BACKFILL_UNSTICK";

    private final boolean enabled;
    private final EngagementRepository engagementRepository;
    private final ComplianceRoutingService complianceRoutingService;
    private final EngagementActivationService engagementActivationService;

    public UnstickOnboardingRunner(
            @Value("${app.backfill.unstuck-onboarding-enabled:false}") boolean enabled,
            EngagementRepository engagementRepository,
            ComplianceRoutingService complianceRoutingService,
            EngagementActivationService engagementActivationService) {
        this.enabled = enabled;
        this.engagementRepository = engagementRepository;
        this.complianceRoutingService = complianceRoutingService;
        this.engagementActivationService = engagementActivationService;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            log.info("[UnstickOnboardingRunner] skipped — disabled "
                    + "(set app.backfill.unstuck-onboarding-enabled=true to enable).");
            return;
        }
        try {
            List<Engagement> pending = engagementRepository
                    .findByStatus(EngagementStatus.PENDING_COMPLIANCE);
            int scanned = pending.size();
            int advanced = 0;
            int stillBlocked = 0;
            int failed = 0;
            for (Engagement e : pending) {
                try {
                    if (complianceRoutingService.requirementsSatisfied(e)) {
                        engagementActivationService.tryAdvance(e, AUDIT_ACTION);
                        log.info("[UnstickOnboardingRunner] advanced engagement {} "
                                + "(candidate {})",
                                e.getId(),
                                e.getCandidate() != null ? e.getCandidate().getId() : null);
                        advanced++;
                    } else {
                        stillBlocked++;
                    }
                } catch (Exception ex) {
                    failed++;
                    log.warn("[UnstickOnboardingRunner] failed to advance engagement {} "
                            + "(non-fatal): {}", e.getId(), ex.getMessage());
                }
            }
            log.info("[UnstickOnboardingRunner] summary: scanned={}, advanced={}, "
                    + "still-blocked={}, failed={}",
                    scanned, advanced, stillBlocked, failed);
        } catch (Exception e) {
            log.warn("[UnstickOnboardingRunner] sweep failed (non-fatal): {}",
                    e.getMessage(), e);
        }
    }
}
