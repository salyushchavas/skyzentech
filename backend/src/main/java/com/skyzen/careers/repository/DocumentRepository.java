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

    /**
     * Phase B (volume → S3) migration finders. Discriminator on
     * {@code storage_key} shape: rows with a leading "/" still live on
     * the volume; the migration runner reads them and copies the bytes
     * to S3, then rewrites the column to the S3 key shape.
     */
    List<Document> findByStorageKeyStartingWith(String prefix);
    long countByStorageKeyStartingWith(String prefix);
}
