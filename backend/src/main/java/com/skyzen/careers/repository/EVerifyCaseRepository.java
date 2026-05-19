package com.skyzen.careers.repository;

import com.skyzen.careers.entity.EVerifyCase;
import com.skyzen.careers.enums.EVerifyStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EVerifyCaseRepository extends JpaRepository<EVerifyCase, UUID> {

    Optional<EVerifyCase> findByI9FormId(UUID i9FormId);

    Page<EVerifyCase> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<EVerifyCase> findByStatusOrderByCreatedAtDesc(EVerifyStatus status, Pageable pageable);

    boolean existsByI9FormId(UUID i9FormId);
}
