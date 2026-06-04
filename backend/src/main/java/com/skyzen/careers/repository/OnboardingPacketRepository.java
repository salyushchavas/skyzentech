package com.skyzen.careers.repository;

import com.skyzen.careers.entity.OnboardingPacket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OnboardingPacketRepository extends JpaRepository<OnboardingPacket, UUID> {

    Optional<OnboardingPacket> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);
}
