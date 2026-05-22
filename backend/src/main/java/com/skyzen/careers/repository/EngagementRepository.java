package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.enums.EngagementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
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

    // ── Phase 3 step 10 — count + roster helpers ────────────────────────────

    long countByStatus(EngagementStatus status);

    long countByStatusIn(Collection<EngagementStatus> statuses);

    /** Distinct candidate count across the given statuses. */
    @Query("SELECT COUNT(DISTINCT e.candidate.id) FROM Engagement e " +
            "WHERE e.status IN :statuses")
    long countDistinctCandidatesByStatusIn(@Param("statuses") Collection<EngagementStatus> statuses);

    /**
     * Supervised-interns roster: engagements that are ACTIVE or beyond, with
     * candidate + user + entity + assignedEvaluator + posting eagerly loaded.
     * Optional entity filter + case-insensitive search on candidate name/email.
     * Newest start first.
     */
    @Query("SELECT e FROM Engagement e " +
            "JOIN FETCH e.candidate c " +
            "JOIN FETCH c.user u " +
            "LEFT JOIN FETCH c.assignedEvaluator ae " +
            "JOIN FETCH e.entity en " +
            "LEFT JOIN FETCH e.application a " +
            "LEFT JOIN FETCH a.jobPosting jp " +
            "WHERE e.status IN :statuses " +
            "AND (:entityId IS NULL OR en.id = :entityId) " +
            "AND (:search IS NULL OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "                    OR LOWER(u.email)    LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY e.actualStartDate DESC NULLS LAST, e.createdAt DESC")
    List<Engagement> findRosterByStatusIn(@Param("statuses") Collection<EngagementStatus> statuses,
                                          @Param("entityId") UUID entityId,
                                          @Param("search") String search);
}
