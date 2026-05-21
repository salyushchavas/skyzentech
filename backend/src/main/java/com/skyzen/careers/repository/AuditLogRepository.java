package com.skyzen.careers.repository;

import com.skyzen.careers.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findByEntityTypeAndEntityIdOrderByTimestampDesc(
            String entityType, UUID entityId);

    /** Most recent audit entries across all entity types — used by Compliance Overview. */
    List<AuditLog> findTop25ByOrderByTimestampDesc();

    /**
     * Paged + filterable search for the admin audit log viewer.
     * - {@code action} matches exactly when non-null
     * - {@code userIds} restricts to those actors (resolved upstream from
     *   the actorSearch term); pass {@code null} to skip the actor filter
     * - {@code from}/{@code to} bound the timestamp inclusively when non-null
     * Caller supplies sort order via {@link Pageable} (newest first by convention).
     */
    @Query("SELECT a FROM AuditLog a " +
            "WHERE (:action IS NULL OR a.action = :action) " +
            "AND (:userIds IS NULL OR a.userId IN :userIds) " +
            "AND (:from IS NULL OR a.timestamp >= :from) " +
            "AND (:to IS NULL OR a.timestamp <= :to)")
    Page<AuditLog> search(@Param("action") String action,
                          @Param("userIds") Collection<UUID> userIds,
                          @Param("from") Instant from,
                          @Param("to") Instant to,
                          Pageable pageable);

    /** Distinct {@code action} values present in the log, for the filter dropdown. */
    @Query("SELECT DISTINCT a.action FROM AuditLog a ORDER BY a.action ASC")
    List<String> findDistinctActions();
}
