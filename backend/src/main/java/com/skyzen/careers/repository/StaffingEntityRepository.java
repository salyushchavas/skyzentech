package com.skyzen.careers.repository;

import com.skyzen.careers.entity.StaffingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface StaffingEntityRepository extends JpaRepository<StaffingEntity, UUID> {
}
