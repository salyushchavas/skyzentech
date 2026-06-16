package com.skyzen.careers.intern;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.InternLifecycleStatus;
import com.skyzen.careers.event.InternActivatedEvent;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Activation job — every 10 minutes, scans users whose
 * {@code lifecycle_status = ONBOARDING_ACCEPTED} and flips any with a
 * SIGNED offer to {@code ACTIVE_INTERN}.
 *
 * <p>Phase 8.9.1 dropped the {@code startDate <= today} gate: an intern
 * activates the moment onboarding is accepted on top of a signed offer.
 * The tentative start date remains on the offer (used for I-9 timing /
 * scheduling) but no longer blocks the lifecycle flip. The scheduled scan
 * is now mostly a safety net — the doc-completion trigger in
 * {@code DocumentPacketService} fires the single-user activation
 * synchronously when the last onboarding doc is accepted.</p>
 *
 * <p>{@code @EnableScheduling} is already on the application class.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InternActivationJob {

    private final UserRepository userRepository;
    private final InternLifecycleRepository internLifecycleRepository;
    private final OfferRepository offerRepository;
    private final InternLifecycleService internLifecycleService;
    private final ApplicationEventPublisher eventPublisher;
    private final ReportingStructureAutoLinker reportingStructureAutoLinker;

    @Scheduled(fixedDelay = 600_000L, initialDelay = 60_000L) // 10 min
    @Transactional
    public void activateReadyInterns() {
        // Pull candidates whose lifecycle is ONBOARDING_ACCEPTED — small set
        // in steady state; full scan is cheap with an index on lifecycle_status.
        List<User> ready;
        try {
            ready = userRepository.findByLifecycleStatus(
                    InternLifecycleStatus.ONBOARDING_ACCEPTED);
        } catch (Exception e) {
            log.warn("[ActivationJob] query failed (non-fatal): {}", e.getMessage());
            return;
        }
        if (ready.isEmpty()) {
            log.debug("[ActivationJob] no ready interns this tick");
            return;
        }

        int activated = 0;
        for (User u : ready) {
            try {
                if (tryActivateIfReady(u)) activated++;
            } catch (Exception e) {
                log.warn("[ActivationJob] per-user activate failed for {}: {}",
                        u.getId(), e.getMessage());
            }
        }
        if (activated > 0) {
            log.info("[ActivationJob] activated {} interns", activated);
        }
    }

    /**
     * Phase 8.9.1 — single-user activation. Rule simplified: an intern
     * activates as soon as they have a SIGNED (or legacy ACCEPTED) offer
     * AND onboarding is ACCEPTED. The tentative start date no longer gates
     * activation — it stays on the offer as a field used for I-9 timing
     * and scheduling but does not block the lifecycle flip.
     *
     * <p>Returns {@code true} iff the user was flipped. Safe to call from
     * event handlers (e.g. the document-packet completion trigger) —
     * failure is silent so it never blocks the calling transaction.</p>
     */
    @Transactional
    public boolean tryActivateIfReady(User user) {
        if (user == null) return false;
        if (user.getLifecycleStatus() != InternLifecycleStatus.ONBOARDING_ACCEPTED) {
            return false;
        }
        boolean hasSignedOffer;
        try {
            List<Offer> offers = offerRepository
                    .findByApplication_Candidate_User_IdOrderByCreatedAtDesc(user.getId());
            hasSignedOffer = offers.stream().anyMatch(o ->
                    o.getStatus() == com.skyzen.careers.enums.OfferStatus.SIGNED
                            || o.getStatus() == com.skyzen.careers.enums.OfferStatus.ACCEPTED);
        } catch (Exception e) {
            log.warn("[ActivationJob] offer lookup failed for {}: {}",
                    user.getId(), e.getMessage());
            return false;
        }
        if (!hasSignedOffer) return false;
        return activateOneWithActor(user, null);
    }

    /**
     * ERM manual override. Bypasses the start-date gate (documented exception
     * for legitimate early starts) but still requires {@code ONBOARDING_ACCEPTED}
     * — the same atomic re-check in {@link #activateOneWithActor} guarantees
     * we never skip document verification.
     */
    @Transactional
    public boolean activateNow(User user, java.util.UUID actorId) {
        if (user == null) return false;
        return activateOneWithActor(user, actorId);
    }

    private boolean activateOneWithActor(User u, java.util.UUID actorId) {
        InternLifecycle lc = internLifecycleRepository.findByUserId(u.getId()).orElse(null);
        if (lc == null) {
            log.warn("[ActivationJob] no InternLifecycle for user {} — skipping", u.getId());
            return false;
        }
        // Re-check status atomically to avoid racing the manual review path.
        if (u.getLifecycleStatus() != InternLifecycleStatus.ONBOARDING_ACCEPTED) {
            return false;
        }
        boolean advanced = internLifecycleService.advance(u,
                InternLifecycleStatus.ACTIVE_INTERN, actorId);
        if (!advanced) return false;
        Instant now = Instant.now();
        lc.setActiveStatus("ACTIVE");
        if (lc.getStartedAt() == null) lc.setStartedAt(now);
        // Backstop for the org-wide T/E auto-link. The same call runs at
        // offer-sign in OfferIdmsSigningService; running it again here is
        // idempotent (the linker preserves existing non-null assignments)
        // and covers the case where DEFAULT_TRAINER_EMAIL /
        // DEFAULT_EVALUATOR_EMAIL didn't resolve at sign-time (env var
        // unset or trainer user not yet seeded) but does now. Without
        // this, the Trainer/Evaluator queries — which filter on
        // intern_lifecycles.{trainer_id,evaluator_id} — would silently
        // omit the intern even after activation.
        try {
            reportingStructureAutoLinker.apply(lc, actorId, now);
        } catch (Exception e) {
            log.warn("[ActivationJob] auto-link backstop failed (non-fatal) for {}: {}",
                    u.getId(), e.getMessage());
        }
        internLifecycleRepository.save(lc);
        try {
            eventPublisher.publishEvent(new InternActivatedEvent(u.getId(), lc.getId()));
        } catch (Exception e) {
            log.warn("InternActivatedEvent publish failed: {}", e.getMessage());
        }
        log.info("[ActivationJob] activated user={} employee_id={}",
                u.getId(), lc.getEmployeeId());
        return true;
    }
}
