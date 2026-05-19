package com.skyzen.careers.repository;

import com.skyzen.careers.entity.OnboardingTask;
import com.skyzen.careers.enums.OnboardingTaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OnboardingTaskRepository extends JpaRepository<OnboardingTask, UUID> {

    List<OnboardingTask> findByCandidateIdOrderBySortOrderAsc(UUID candidateId);

    List<OnboardingTask> findByCandidateIdAndOfferIdOrderBySortOrderAsc(
            UUID candidateId, UUID offerId);

    Optional<OnboardingTask> findByCandidateIdAndTaskKeyAndOfferId(
            UUID candidateId, String taskKey, UUID offerId);

    boolean existsByCandidateIdAndOfferId(UUID candidateId, UUID offerId);

    long countByCandidateIdAndStatus(UUID candidateId, OnboardingTaskStatus status);
}
