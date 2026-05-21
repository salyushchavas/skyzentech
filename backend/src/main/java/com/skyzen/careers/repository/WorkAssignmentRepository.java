package com.skyzen.careers.repository;

import com.skyzen.careers.entity.WorkAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface WorkAssignmentRepository extends JpaRepository<WorkAssignment, UUID> {
    List<WorkAssignment> findByInternIdOrderByDueDateDesc(UUID internId);
}
