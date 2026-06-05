package com.skyzen.careers.repository;

import com.skyzen.careers.entity.OnboardingReviewLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OnboardingReviewLogRepository
        extends JpaRepository<OnboardingReviewLog, UUID> {

    List<OnboardingReviewLog> findByOnboardingItemIdOrderByCreatedAtDesc(UUID itemId);
}
