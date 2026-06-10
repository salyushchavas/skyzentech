package com.skyzen.careers.repository;

import com.skyzen.careers.entity.DocumentTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentTemplateRepository
        extends JpaRepository<DocumentTemplate, UUID> {

    Optional<DocumentTemplate> findByTitle(String title);

    boolean existsByTitle(String title);

    Page<DocumentTemplate> findByIsActiveTrueOrderByCategoryAscTitleAsc(Pageable p);

    Page<DocumentTemplate> findByCategoryAndIsActiveTrueOrderByTitleAsc(
            String category, Pageable p);

    List<DocumentTemplate> findByIsActiveTrueOrderByCategoryAscTitleAsc();
}
