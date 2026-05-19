package com.skyzen.careers.repository;

import com.skyzen.careers.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findByEntityTypeAndEntityIdOrderByTimestampDesc(
            String entityType, UUID entityId);

    /** Most recent audit entries across all entity types — used by Compliance Overview. */
    List<AuditLog> findTop25ByOrderByTimestampDesc();
}
