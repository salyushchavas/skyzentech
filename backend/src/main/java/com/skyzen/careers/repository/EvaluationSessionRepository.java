package com.skyzen.careers.repository;

import com.skyzen.careers.entity.EvaluationSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EvaluationSessionRepository extends JpaRepository<EvaluationSession, UUID> {
    List<EvaluationSession> findByInternIdOrderByScheduledAtDesc(UUID internId);
}
