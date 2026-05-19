package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Interview;
import com.skyzen.careers.enums.InterviewStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface InterviewRepository extends JpaRepository<Interview, UUID> {

    List<Interview> findByApplicationIdOrderByScheduledAtDesc(UUID applicationId);

    Page<Interview> findByInterviewerIdAndStatusOrderByScheduledAtAsc(
            UUID interviewerId, InterviewStatus status, Pageable pageable);

    Page<Interview> findByScheduledAtAfterOrderByScheduledAtAsc(Instant cutoff, Pageable pageable);

    Page<Interview> findByScheduledAtBeforeOrderByScheduledAtDesc(Instant cutoff, Pageable pageable);

    long countByApplicationIdAndStatus(UUID applicationId, InterviewStatus status);

    boolean existsByApplicationIdAndStatus(UUID applicationId, InterviewStatus status);

    @Query("SELECT i FROM Interview i " +
            "WHERE i.application.candidate.user.id = :userId " +
            "ORDER BY i.scheduledAt DESC")
    List<Interview> findAllForCandidateUser(@Param("userId") UUID userId);

    @Query("SELECT i FROM Interview i " +
            "WHERE (:applicationId IS NULL OR i.application.id = :applicationId) " +
            "AND (:status IS NULL OR i.status = :status) " +
            "AND (:interviewerId IS NULL OR i.interviewer.id = :interviewerId) " +
            "AND (:upcomingCutoff IS NULL OR i.scheduledAt >= :upcomingCutoff) " +
            "AND (:pastCutoff IS NULL OR i.scheduledAt < :pastCutoff)")
    Page<Interview> search(@Param("applicationId") UUID applicationId,
                           @Param("status") InterviewStatus status,
                           @Param("interviewerId") UUID interviewerId,
                           @Param("upcomingCutoff") Instant upcomingCutoff,
                           @Param("pastCutoff") Instant pastCutoff,
                           Pageable pageable);
}
