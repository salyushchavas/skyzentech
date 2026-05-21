package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Application;
import com.skyzen.careers.enums.ApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ApplicationRepository
        extends JpaRepository<Application, UUID>,
        JpaSpecificationExecutor<Application> {
    List<Application> findByCandidateId(UUID candidateId);
    List<Application> findByJobPostingId(UUID jobPostingId);

    /**
     * Candidate's applications with the JobPosting + StaffingEntity chain
     * eagerly loaded — used by the staff-side candidate detail page so the
     * mapper can read posting title + entity name without lazy-loading.
     */
    @Query("SELECT a FROM Application a " +
            "JOIN FETCH a.jobPosting jp " +
            "LEFT JOIN FETCH jp.entity e " +
            "WHERE a.candidate.id = :candidateId " +
            "ORDER BY a.appliedAt DESC")
    List<Application> findByCandidateIdWithPosting(@Param("candidateId") UUID candidateId);

    boolean existsByCandidateIdAndJobPostingId(UUID candidateId, UUID jobPostingId);
    boolean existsByResumeId(UUID resumeId);
    boolean existsByStatus(ApplicationStatus status);

    long countByStatus(ApplicationStatus status);

    /** Distinct candidates with at least one application in the given status. */
    @Query("SELECT COUNT(DISTINCT a.candidate.id) FROM Application a WHERE a.status = :status")
    long countDistinctCandidatesByStatus(@Param("status") ApplicationStatus status);

    /**
     * Batch applicant-count lookup for the admin postings page. Returns one
     * row per posting that has at least one application: {@code [postingId, count]}.
     * Postings with zero applications are absent from the result — callers
     * fill those in as 0. One query, O(1) for any page size.
     */
    @Query("SELECT a.jobPosting.id, COUNT(a) FROM Application a " +
            "WHERE a.jobPosting.id IN :postingIds " +
            "GROUP BY a.jobPosting.id")
    List<Object[]> countByJobPostingIdIn(@Param("postingIds") java.util.Collection<UUID> postingIds);

    @Query("SELECT a FROM Application a " +
            "WHERE (:status IS NULL OR a.status = :status) " +
            "AND (:jobPostingId IS NULL OR a.jobPosting.id = :jobPostingId)")
    Page<Application> search(@Param("status") ApplicationStatus status,
                             @Param("jobPostingId") UUID jobPostingId,
                             Pageable pageable);

    /**
     * Hired applications with their full candidate + posting + entity graph
     * eagerly loaded, for the Supervised Interns roster (Group C). A candidate
     * may have multiple HIRED rows (rare, but allowed); the service dedupes by
     * candidate id, keeping the most recent by statusUpdatedAt thanks to the
     * ORDER BY clause.
     */
    @Query("SELECT a FROM Application a " +
            "JOIN FETCH a.candidate c " +
            "JOIN FETCH c.user u " +
            "LEFT JOIN FETCH c.assignedEvaluator ae " +
            "JOIN FETCH a.jobPosting jp " +
            "JOIN FETCH jp.entity e " +
            "WHERE a.status = com.skyzen.careers.enums.ApplicationStatus.HIRED " +
            "AND (:entityId IS NULL OR e.id = :entityId) " +
            "AND (:search IS NULL OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "                    OR LOWER(u.email)    LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY a.statusUpdatedAt DESC")
    List<Application> findHiredInterns(@Param("entityId") UUID entityId,
                                       @Param("search") String search);

    /**
     * Hired applications for interns whose {@code assignedEvaluator} is the
     * given user. Used by the Evaluator area to scope lists/dashboard to the
     * caller's own roster. Same fetch graph as {@link #findHiredInterns} so
     * mappers can read position + entityName without lazy-loading.
     */
    @Query("SELECT a FROM Application a " +
            "JOIN FETCH a.candidate c " +
            "JOIN FETCH c.user u " +
            "JOIN FETCH a.jobPosting jp " +
            "JOIN FETCH jp.entity e " +
            "WHERE a.status = com.skyzen.careers.enums.ApplicationStatus.HIRED " +
            "AND c.assignedEvaluator.id = :evaluatorUserId " +
            "ORDER BY a.statusUpdatedAt DESC")
    List<Application> findHiredInternsForEvaluator(@Param("evaluatorUserId") UUID evaluatorUserId);
}
