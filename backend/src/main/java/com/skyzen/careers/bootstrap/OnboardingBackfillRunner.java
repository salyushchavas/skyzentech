package com.skyzen.careers.bootstrap;

import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.OnboardingTaskRepository;
import com.skyzen.careers.service.OnboardingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * One-time-ish backfill: for every ACCEPTED offer that doesn't yet have onboarding
 * tasks, seed them. Safe to run on every startup — idempotency check inside
 * {@link OnboardingService#seedTasksForAcceptedOffer} keeps it cheap.
 *
 * Runs after {@code SeedDemoDataRunner} (@Order(4)).
 */
@Component
@Order(5)
@RequiredArgsConstructor
@Slf4j
public class OnboardingBackfillRunner implements CommandLineRunner {

    private final OfferRepository offerRepository;
    private final OnboardingTaskRepository taskRepository;
    private final OnboardingService onboardingService;

    @Override
    public void run(String... args) {
        List<Offer> accepted = offerRepository
                .findByStatusOrderByCreatedAtDesc(OfferStatus.ACCEPTED, Pageable.unpaged())
                .getContent();

        int backfilled = 0;
        for (Offer offer : accepted) {
            if (offer.getApplication() == null
                    || offer.getApplication().getCandidate() == null) {
                continue;
            }
            UUID candidateId = offer.getApplication().getCandidate().getId();
            if (taskRepository.existsByCandidateIdAndOfferId(candidateId, offer.getId())) {
                continue;
            }
            try {
                onboardingService.seedTasksForAcceptedOffer(offer);
                backfilled++;
            } catch (Exception e) {
                log.warn("Onboarding backfill failed for offer {}: {}",
                        offer.getId(), e.getMessage());
            }
        }
        log.info("Backfilled onboarding tasks for {} previously-accepted offer(s)", backfilled);
    }
}
