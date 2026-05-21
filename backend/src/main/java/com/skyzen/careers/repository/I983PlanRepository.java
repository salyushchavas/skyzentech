package com.skyzen.careers.repository;

import com.skyzen.careers.entity.I983Plan;
import com.skyzen.careers.enums.I983Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface I983PlanRepository extends JpaRepository<I983Plan, UUID> {

    List<I983Plan> findByCandidateIdOrderByCreatedAtDesc(UUID candidateId);

    Page<I983Plan> findAllByOrderByUpdatedAtDesc(Pageable pageable);

    Page<I983Plan> findByStatusOrderByUpdatedAtDesc(I983Status status, Pageable pageable);

    Page<I983Plan> findByEntityIdOrderByUpdatedAtDesc(UUID entityId, Pageable pageable);

    long countByStatus(I983Status status);

    /** Count of I-983 plans NOT yet DSO_APPROVED. */
    long countByStatusNot(I983Status status);
}
