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
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Phase 4 activation job. Every 10 minutes, scans users whose
 * {@code lifecycle_status = ONBOARDING_ACCEPTED} and flips them to
 * {@code ACTIVE_INTERN} when their offer's {@code tentative_start_date}
 * (a.k.a. {@code start_date}) has arrived. {@code @EnableScheduling} is
 * already on the application class.
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
     * Phase 8.9 — single-user gated activation. Same condition set the
     * scheduled scan uses: status must be {@code ONBOARDING_ACCEPTED} and
     * the latest signed/accepted offer must have a non-null
     * {@code startDate} that is today or in the past. Returns {@code true}
     * iff the user was flipped. Safe to call from event handlers (e.g.
     * the document-packet completion trigger) — failure is silent so it
     * never blocks the calling transaction.
     */
    @Transactional
    public boolean tryActivateIfReady(User user) {
        if (user == null) return false;
        if (user.getLifecycleStatus() != InternLifecycleStatus.ONBOARDING_ACCEPTED) {
            return false;
        }
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate start;
        try {
            List<Offer> offers = offerRepository
                    .findByApplication_Candidate_User_IdOrderByCreatedAtDesc(user.getId());
            start = offers.stream()
                    .filter(o -> o.getStartDate() != null
                            && (o.getStatus() == com.skyzen.careers.enums.OfferStatus.SIGNED
                                    || o.getStatus() == com.skyzen.careers.enums.OfferStatus.ACCEPTED))
                    .map(Offer::getStartDate)
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("[ActivationJob] offer lookup failed for {}: {}",
                    user.getId(), e.getMessage());
            return false;
        }
        if (start == null || start.isAfter(today)) return false;
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
        lc.setActiveStatus("ACTIVE");
        if (lc.getStartedAt() == null) lc.setStartedAt(Instant.now());
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
