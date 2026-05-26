package com.skyzen.careers.repository;

import com.skyzen.careers.entity.EvaluationRubricScore;
import com.skyzen.careers.enums.RubricCriterion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EvaluationRubricScoreRepository
        extends JpaRepository<EvaluationRubricScore, UUID> {

    List<EvaluationRubricScore> findByEvaluationId(UUID evaluationId);

    Optional<EvaluationRubricScore> findByEvaluationIdAndCriterion(
            UUID evaluationId, RubricCriterion criterion);

    void deleteByEvaluationId(UUID evaluationId);
}
