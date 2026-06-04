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

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        int activated = 0;
        for (User u : ready) {
            try {
                List<Offer> offers = offerRepository
                        .findByApplication_Candidate_User_IdOrderByCreatedAtDesc(u.getId());
                LocalDate start = offers.stream()
                        .filter(o -> o.getStartDate() != null
                                && (o.getStatus() == com.skyzen.careers.enums.OfferStatus.SIGNED
                                        || o.getStatus() == com.skyzen.careers.enums.OfferStatus.ACCEPTED))
                        .map(Offer::getStartDate)
                        .findFirst()
                        .orElse(null);
                if (start == null || start.isAfter(today)) continue;
                activated += activateOne(u) ? 1 : 0;
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
     * Manual override path. Bypasses the start-date gate (ERM may activate an
     * intern early on a documented exception). Caller responsibility is in
     * the controller.
     */
    @Transactional
    public boolean activateNow(User user, java.util.UUID actorId) {
        if (user == null) return false;
        return activateOneWithActor(user, actorId);
    }

    private boolean activateOne(User u) {
        return activateOneWithActor(u, null);
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
