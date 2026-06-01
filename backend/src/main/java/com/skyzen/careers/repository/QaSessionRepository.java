package com.skyzen.careers.repository;

import com.skyzen.careers.entity.QaSession;
import com.skyzen.careers.enums.QaSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QaSessionRepository extends JpaRepository<QaSession, UUID> {

    /**
     * Full fetch graph for a single session — project + engagement + RM +
     * intern user — so the service / DTO mapper never lazy-loads after the
     * transaction closes.
     */
    @Query("SELECT s FROM QaSession s "
            + "JOIN FETCH s.project p "
            + "JOIN FETCH p.engagement e "
            + "LEFT JOIN FETCH e.reportingManager rm "
            + "JOIN FETCH p.intern i "
            + "JOIN FETCH i.user iu "
            + "LEFT JOIN FETCH s.scheduledBy sb "
            + "LEFT JOIN FETCH s.conductedBy cb "
            + "WHERE s.id = :id")
    Optional<QaSession> findByIdWithGraph(@Param("id") UUID id);

    /** All sessions on a project, newest first. */
    @Query("SELECT s FROM QaSession s "
            + "JOIN FETCH s.project p "
            + "JOIN FETCH p.engagement e "
            + "LEFT JOIN FETCH e.reportingManager rm "
            + "JOIN FETCH p.intern i "
            + "JOIN FETCH i.user iu "
            + "WHERE p.id = :projectId "
            + "ORDER BY s.scheduledAt DESC, s.createdAt DESC")
    List<QaSession> findByProjectIdWithGraph(@Param("projectId") UUID projectId);

    /** Active sessions on RM's projects (SCHEDULED or CONDUCTED). */
    @Query("SELECT s FROM QaSession s "
            + "JOIN FETCH s.project p "
            + "JOIN FETCH p.engagement e "
            + "JOIN FETCH p.intern i "
            + "JOIN FETCH i.user iu "
            + "WHERE e.reportingManager.id = :rmUserId "
            + "  AND s.status IN :statuses "
            + "ORDER BY s.scheduledAt ASC")
    List<QaSession> findActiveForRm(@Param("rmUserId") UUID rmUserId,
                                    @Param("statuses") List<QaSessionStatus> statuses);
}
