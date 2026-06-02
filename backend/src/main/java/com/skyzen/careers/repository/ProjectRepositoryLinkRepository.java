package com.skyzen.careers.repository;

import com.skyzen.careers.entity.ProjectRepositoryLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectRepositoryLinkRepository
        extends JpaRepository<ProjectRepositoryLink, UUID> {

    Optional<ProjectRepositoryLink> findByProjectId(UUID projectId);

    boolean existsByProjectId(UUID projectId);
}
