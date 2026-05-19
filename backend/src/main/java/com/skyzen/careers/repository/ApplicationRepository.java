package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Application;
import com.skyzen.careers.enums.ApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, UUID> {
    List<Application> findByCandidateId(UUID candidateId);
    List<Application> findByJobPostingId(UUID jobPostingId);

    boolean existsByCandidateIdAndJobPostingId(UUID candidateId, UUID jobPostingId);
    boolean existsByResumeId(UUID resumeId);

    @Query("SELECT a FROM Application a " +
            "WHERE (:status IS NULL OR a.status = :status) " +
            "AND (:jobPostingId IS NULL OR a.jobPosting.id = :jobPostingId)")
    Page<Application> search(@Param("status") ApplicationStatus status,
                             @Param("jobPostingId") UUID jobPostingId,
                             Pageable pageable);
}
