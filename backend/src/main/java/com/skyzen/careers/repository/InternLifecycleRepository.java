package com.skyzen.careers.repository;

import com.skyzen.careers.entity.InternLifecycle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InternLifecycleRepository extends JpaRepository<InternLifecycle, UUID> {

    Optional<InternLifecycle> findByUserId(UUID userId);

    Optional<InternLifecycle> findByEmployeeId(String employeeId);

    boolean existsByUserId(UUID userId);
}
