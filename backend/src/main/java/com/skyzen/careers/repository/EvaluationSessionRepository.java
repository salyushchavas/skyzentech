package com.skyzen.careers.repository;

import com.skyzen.careers.entity.EvaluationSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EvaluationSessionRepository extends JpaRepository<EvaluationSession, UUID> {

    /**
     * Staff list for an intern, newest scheduled first. Fetch-joins intern.user
     * and the (nullable) evaluator so the DTO mapper renders evaluatorName
     * without hitting a detached lazy proxy after the transaction closes.
     */
    @Query("SELECT s FROM EvaluationSession s " +
            "JOIN FETCH s.intern i " +
            "JOIN FETCH i.user iu " +
            "LEFT JOIN FETCH s.evaluator e " +
            "WHERE i.id = :candidateId " +
            "ORDER BY s.scheduledAt DESC")
    List<EvaluationSession> findForIntern(@Param("candidateId") UUID candidateId);

    /** Candidate's own sessions, newest scheduled first. */
    @Query("SELECT s FROM EvaluationSession s " +
            "JOIN FETCH s.intern i " +
            "JOIN FETCH i.user iu " +
            "LEFT JOIN FETCH s.evaluator e " +
            "WHERE iu.id = :userId " +
            "ORDER BY s.scheduledAt DESC")
    List<EvaluationSession> findForCandidateUser(@Param("userId") UUID userId);

    /**
     * Single session with intern + intern.user + evaluator eagerly loaded so
     * mutation handlers (complete/miss) can write the response DTO without
     * tripping a LazyInitializationException.
     */
    @Query("SELECT s FROM EvaluationSession s " +
            "JOIN FETCH s.intern i " +
            "JOIN FETCH i.user iu " +
            "LEFT JOIN FETCH s.evaluator e " +
            "WHERE s.id = :id")
    Optional<EvaluationSession> findByIdWithGraph(@Param("id") UUID id);
}
