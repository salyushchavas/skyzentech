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
}
