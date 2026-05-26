package com.skyzen.careers.repository;

import com.skyzen.careers.entity.EvaluationSelfReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EvaluationSelfReviewRepository
        extends JpaRepository<EvaluationSelfReview, UUID> {

    Optional<EvaluationSelfReview> findByEvaluationId(UUID evaluationId);
}
