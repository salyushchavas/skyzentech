package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.enums.OfferStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface OfferRepository extends JpaRepository<Offer, UUID> {

    List<Offer> findByApplicationIdOrderByCreatedAtDesc(UUID applicationId);

    Page<Offer> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Offer> findByStatusOrderByCreatedAtDesc(OfferStatus status, Pageable pageable);

    List<Offer> findByApplication_Candidate_IdOrderByCreatedAtDesc(UUID candidateId);

    List<Offer> findByApplication_Candidate_User_IdOrderByCreatedAtDesc(UUID userId);

    List<Offer> findByStatusAndExpiresAtBefore(OfferStatus status, Instant cutoff);
}
