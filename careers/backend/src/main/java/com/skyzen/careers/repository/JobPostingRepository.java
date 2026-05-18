package com.skyzen.careers.repository;

import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.enums.JobPostingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface JobPostingRepository extends JpaRepository<JobPosting, UUID> {
    List<JobPosting> findByStatus(JobPostingStatus status);
    List<JobPosting> findByEntityId(UUID entityId);
}
