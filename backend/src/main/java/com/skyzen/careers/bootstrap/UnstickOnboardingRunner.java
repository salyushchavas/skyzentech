package com.skyzen.careers.bootstrap;

import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.service.ComplianceRoutingService;
import com.skyzen.careers.service.EngagementAutoAdvancer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * One-off backfill that unsticks engagements which sit in
 * {@code PENDING_COMPLIANCE} even though every compliance item is already
 * in its done-state. These rows exist because before
 * {@link EngagementAutoAdvancer} landed, nothing watched the compliance
 * services to auto-flip the engagement past the gate — HR had to click
 * "Mark Ready" by hand and it was easy to forget.
 *
 * <p>Idempotent + gated by {@code app.backfill.unstuck-onboarding-enabled=true}
 * (env {@code BACKFILL_UNSTUCK_ONBOARDING}). Default false. Once it has
 * run on a database and there are no stuck rows left, leaving the flag
 * unset is the right thing — the runner is harmless even on re-runs but
 * there's no point doing the work.</p>
 *
 * <p>Each candidate engagement is delegated to
 * {@link EngagementAutoAdvancer#tryAdvance(Engagement)}, which already
 * does the legal-state + requirements-satisfied checks and the audit
 * write. We just supply the iteration.</p>
 */
@Component
@Order(20)
@Slf4j
public class UnstickOnboardingRunner implements CommandLineRunner {

    private final boolean enabled;
    private final EngagementRepository engagementRepository;
    private final ComplianceRoutingService complianceRoutingService;
    private final EngagementAutoAdvancer engagementAutoAdvancer;

    public UnstickOnboardingRunner(
            @Value("${app.backfill.unstuck-onboarding-enabled:false}") boolean enabled,
            EngagementRepository engagementRepository,
            ComplianceRoutingService complianceRoutingService,
            EngagementAutoAdvancer engagementAutoAdvancer) {
        this.enabled = enabled;
        this.engagementRepository = engagementRepository;
        this.complianceRoutingService = complianceRoutingService;
        this.engagementAutoAdvancer = engagementAutoAdvancer;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            log.info("Unstick-onboarding backfill skipped — disabled "
                    + "(set app.backfill.unstuck-onboarding-enabled=true to enable).");
            return;
        }
        try {
            List<Engagement> pending = engagementRepository
                    .findByStatus(EngagementStatus.PENDING_COMPLIANCE);
            int candidates = pending.size();
            int advanced = 0;
            int stillBlocked = 0;
            for (Engagement e : pending) {
                try {
                    if (complianceRoutingService.requirementsSatisfied(e)) {
                        engagementAutoAdvancer.tryAdvance(e);
                        advanced++;
                    } else {
                        stillBlocked++;
                    }
                } catch (Exception ex) {
                    log.warn("Unstick-onboarding: failed to advance engagement {} (non-fatal): {}",
                            e.getId(), ex.getMessage());
                }
            }
            log.info("Unstick-onboarding backfill: scanned={}, advanced={}, "
                    + "still-blocked={} (compliance not yet satisfied).",
                    candidates, advanced, stillBlocked);
        } catch (Exception e) {
            log.warn("Unstick-onboarding backfill failed (non-fatal): {}", e.getMessage(), e);
        }
    }
}
