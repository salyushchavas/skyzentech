package com.skyzen.careers.repository;

import com.skyzen.careers.entity.EvaluationAmendment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EvaluationAmendmentRepository extends JpaRepository<EvaluationAmendment, UUID> {

    List<EvaluationAmendment> findByEvaluationIdOrderByAmendedAtAsc(UUID evaluationId);
}
