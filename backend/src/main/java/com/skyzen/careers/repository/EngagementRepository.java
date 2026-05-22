package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.enums.EngagementStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Phase 3 step 1 — repository surface for {@link Engagement}. Nothing calls
 * this yet; future steps wire it into OFFER_ACCEPTED creation, the transition
 * guard, and the engagement-scoped queries that replace candidate-keyed reads
 * on Group C / I-9 / I-983 / onboarding.
 */
public interface EngagementRepository extends JpaRepository<Engagement, UUID> {

    Optional<Engagement> findByApplicationId(UUID applicationId);

    Optional<Engagement> findByOfferId(UUID offerId);

    List<Engagement> findByCandidateId(UUID candidateId);

    List<Engagement> findByCandidateIdAndStatus(UUID candidateId, EngagementStatus status);

    List<Engagement> findByStatus(EngagementStatus status);

    boolean existsByApplicationId(UUID applicationId);
}
