package com.skyzen.careers.repository;

import com.skyzen.careers.entity.OnboardingItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OnboardingItemRepository extends JpaRepository<OnboardingItem, UUID> {

    List<OnboardingItem> findByPacketIdOrderByCategoryAsc(UUID packetId);

    Optional<OnboardingItem> findByPacketIdAndCategory(UUID packetId, String category);

    Page<OnboardingItem> findByStatusOrderBySubmittedAtAsc(String status, Pageable pageable);

    long countByPacketIdAndRequiredTrueAndStatusNot(UUID packetId, String status);
}
