package com.skyzen.careers.repository;

import com.skyzen.careers.entity.ProjectAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProjectAssignmentRepository
        extends JpaRepository<ProjectAssignment, UUID> {

    /** Intern view — every assignment to this user, newest first. */
    List<ProjectAssignment> findByInternIdOrderByAssignmentDateDescCreatedAtDesc(UUID internId);

    /** Project detail page — every assignment under a given catalog project. */
    List<ProjectAssignment> findByProjectIdOrderByAssignmentDateDescCreatedAtDesc(UUID projectId);

    /** TE view — every assignment this user created. */
    List<ProjectAssignment> findByAssignedByIdOrderByAssignmentDateDescCreatedAtDesc(UUID assignedById);

    long countByProjectId(UUID projectId);
}
