package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Resume;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ResumeRepository extends JpaRepository<Resume, UUID> {
    List<Resume> findByCandidateId(UUID candidateId);
    long countByCandidateId(UUID candidateId);

    @Modifying
    @Query("UPDATE Resume r SET r.isDefault = false " +
            "WHERE r.candidate.id = :candidateId AND r.id <> :resumeId")
    void clearDefaultForOtherResumes(@Param("candidateId") UUID candidateId,
                                     @Param("resumeId") UUID resumeId);
}
