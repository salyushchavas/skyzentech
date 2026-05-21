package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Candidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CandidateRepository extends JpaRepository<Candidate, UUID> {
    Optional<Candidate> findByUserId(UUID userId);

    /**
     * Candidate with {@code assignedEvaluator} eagerly loaded. Used by the
     * Supervised Work overview so the DTO mapper can read the evaluator's
     * fullName without tripping a LazyInitializationException once the
     * read-only transaction closes.
     */
    @Query("SELECT c FROM Candidate c " +
            "LEFT JOIN FETCH c.assignedEvaluator " +
            "WHERE c.user.id = :userId")
    Optional<Candidate> findByUserIdWithEvaluator(@Param("userId") UUID userId);

    /**
     * Paged search across candidate name + email. Fetch-joins {@code user} so
     * the list DTO mapper can read name/email/phone without lazy-loading.
     * {@code search} is matched case-insensitively against both fields; pass
     * {@code null} to skip the filter.
     */
    @Query(value = "SELECT c FROM Candidate c " +
            "JOIN FETCH c.user u " +
            "WHERE :search IS NULL " +
            "   OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "   OR LOWER(u.email)    LIKE LOWER(CONCAT('%', :search, '%'))",
           countQuery = "SELECT COUNT(c) FROM Candidate c " +
            "WHERE :search IS NULL " +
            "   OR LOWER(c.user.fullName) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "   OR LOWER(c.user.email)    LIKE LOWER(CONCAT('%', :search, '%'))")
    org.springframework.data.domain.Page<Candidate> searchWithUser(
            @Param("search") String search,
            org.springframework.data.domain.Pageable pageable);

    /** Single candidate with the user graph eagerly loaded. */
    @Query("SELECT c FROM Candidate c " +
            "JOIN FETCH c.user u " +
            "WHERE c.id = :id")
    Optional<Candidate> findByIdWithUser(@Param("id") UUID id);
}
