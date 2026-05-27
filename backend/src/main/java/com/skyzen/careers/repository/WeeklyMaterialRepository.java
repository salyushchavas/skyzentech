package com.skyzen.careers.repository;

import com.skyzen.careers.entity.WeeklyMaterial;
import com.skyzen.careers.enums.WeeklyMaterialStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WeeklyMaterialRepository extends JpaRepository<WeeklyMaterial, UUID> {

    /** Supervisor's own published list. Newest first. */
    List<WeeklyMaterial> findByPublishedByIdOrderByCreatedAtDesc(UUID publishedById);

    /**
     * Single material with publisher + engagement (+ engagement's candidate) fetched
     * eagerly so the toResponse mapping doesn't lazy-load after the @Transactional
     * method closes under open-in-view=false.
     */
    @Query("SELECT m FROM WeeklyMaterial m " +
            "JOIN FETCH m.publishedBy p " +
            "LEFT JOIN FETCH m.engagement e " +
            "LEFT JOIN FETCH e.candidate c " +
            "LEFT JOIN FETCH c.user u " +
            "WHERE m.id = :id")
    Optional<WeeklyMaterial> findByIdWithGraph(@Param("id") UUID id);

    /**
     * Intern-visible feed (GAP C1). Returns RELEASED materials that are
     * EITHER broadcast (engagement_id IS NULL) OR scoped to the supplied
     * engagement id. Newest release first. Active-engagement gating is the
     * caller's responsibility — this query only handles the visibility
     * predicate.
     */
    @Query("SELECT m FROM WeeklyMaterial m " +
            "JOIN FETCH m.publishedBy p " +
            "LEFT JOIN FETCH m.engagement e " +
            "WHERE m.status = :status " +
            "  AND (m.engagement IS NULL OR m.engagement.id = :engagementId) " +
            "ORDER BY m.releaseDate DESC, m.createdAt DESC")
    List<WeeklyMaterial> findVisibleForEngagement(
            @Param("status") WeeklyMaterialStatus status,
            @Param("engagementId") UUID engagementId);

    /**
     * RELEASED materials whose release sits in {@code (cutoffMin, cutoffMax]} —
     * the "released N days ago, still unread" window used by the unread-
     * reminder scheduler. Newest first. Returns scoped + broadcast rows; the
     * scheduler resolves recipients downstream.
     */
    @Query("SELECT m FROM WeeklyMaterial m " +
            "LEFT JOIN FETCH m.engagement e " +
            "LEFT JOIN FETCH e.candidate c " +
            "LEFT JOIN FETCH c.user u " +
            "WHERE m.status = com.skyzen.careers.enums.WeeklyMaterialStatus.RELEASED " +
            "  AND m.releaseDate IS NOT NULL " +
            "  AND m.releaseDate >= :cutoffMin " +
            "  AND m.releaseDate < :cutoffMax " +
            "ORDER BY m.releaseDate DESC")
    List<WeeklyMaterial> findReleasedBetween(
            @Param("cutoffMin") Instant cutoffMin,
            @Param("cutoffMax") Instant cutoffMax);
}
