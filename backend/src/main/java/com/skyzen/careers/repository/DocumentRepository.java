package com.skyzen.careers.repository;

import com.skyzen.careers.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByOwnerUserIdOrderByCreatedAtDesc(UUID ownerUserId);

    List<Document> findByOwnerUserIdAndCategoryOrderByCreatedAtDesc(UUID ownerUserId, String category);

    /** Phase 4 vault listing — non-soft-deleted, newest first. */
    List<Document> findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID ownerUserId);
}
