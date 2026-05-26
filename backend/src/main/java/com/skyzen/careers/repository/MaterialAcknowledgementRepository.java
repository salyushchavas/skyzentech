package com.skyzen.careers.repository;

import com.skyzen.careers.entity.MaterialAcknowledgement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MaterialAcknowledgementRepository
        extends JpaRepository<MaterialAcknowledgement, UUID> {

    Optional<MaterialAcknowledgement> findByMaterialIdAndInternId(
            UUID materialId, UUID internId);

    /** Pre-fetch the (material, intern) acks for an entire intern's feed. */
    List<MaterialAcknowledgement> findByInternId(UUID internId);

    /**
     * Supervisor view — every ack for a material with the intern's user
     * eagerly loaded for the dashboard row's candidate name.
     */
    @Query("SELECT a FROM MaterialAcknowledgement a " +
            "JOIN FETCH a.intern i " +
            "JOIN FETCH i.user u " +
            "WHERE a.material.id = :materialId " +
            "ORDER BY a.acknowledgedAt DESC")
    List<MaterialAcknowledgement> findByMaterialIdWithIntern(
            @Param("materialId") UUID materialId);

    long countByMaterialId(UUID materialId);
}
