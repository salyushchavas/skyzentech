package com.skyzen.careers.erm.documents;

import com.skyzen.careers.entity.Document;
import com.skyzen.careers.entity.DocumentTemplate;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.erm.documents.DocumentDtos.*;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.intern.DocumentVaultService;
import com.skyzen.careers.repository.DocumentRepository;
import com.skyzen.careers.repository.DocumentTemplateRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** ERM Phase 8 — document-template library management. */
@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentTemplateService {

    private static final long MAX_TEMPLATE_FILE_BYTES = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_MIME = Set.of(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel");

    private final DocumentTemplateRepository repository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final DocumentVaultService documentVault;
    private final JdbcTemplate jdbc;

    // ── Reads ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DocumentTemplatePage list(String category, Boolean activeOnly,
                                      String search, int page, int pageSize) {
        int p = Math.max(0, page);
        int ps = Math.min(100, Math.max(1, pageSize));
        Page<DocumentTemplate> data;
        if (category != null && !category.isBlank()) {
            data = repository.findByCategoryAndIsActiveTrueOrderByTitleAsc(
                    category.trim().toUpperCase(), PageRequest.of(p, ps));
        } else if (Boolean.TRUE.equals(activeOnly)) {
            data = repository.findByIsActiveTrueOrderByCategoryAscTitleAsc(
                    PageRequest.of(p, ps));
        } else {
            data = new PageImpl<>(
                    new ArrayList<>(repository.findAll()), PageRequest.of(p, ps),
                    repository.count());
        }
        String q = search == null ? null : search.trim().toLowerCase();
        List<DocumentTemplateDto> items = new ArrayList<>();
        for (DocumentTemplate t : data.getContent()) {
            if (q != null && !q.isEmpty()
                    && !(t.getTitle() != null && t.getTitle().toLowerCase().contains(q))
                    && !(t.getDescription() != null
                            && t.getDescription().toLowerCase().contains(q))) {
                continue;
            }
            items.add(toDto(t));
        }
        int totalPages = ps == 0 ? 0 : (int) Math.ceil((double) data.getTotalElements() / ps);
        return new DocumentTemplatePage(items, p, ps, data.getTotalElements(), totalPages);
    }

    @Transactional(readOnly = true)
    public DocumentTemplateDto get(UUID id) {
        return toDto(mustLoad(id));
    }

    // ── Writes (ERM-only) ────────────────────────────────────────────────

    @Transactional
    public DocumentTemplateDto create(CreateTemplateRequest req, User caller) {
        requireErm(caller);
        if (req == null) throw new BadRequestException("body is required");
        if (req.title() == null || req.title().isBlank() || req.title().length() > 200) {
            throw new BadRequestException("title is required (1-200 chars)");
        }
        if (req.category() == null || req.category().isBlank()) {
            throw new BadRequestException("category is required");
        }
        if (req.fileKind() == null) throw new BadRequestException("fileKind is required");
        if (repository.existsByTitle(req.title().trim())) {
            throw new ConflictException("Template with this title already exists");
        }
        DocumentTemplate t = DocumentTemplate.builder()
                .title(req.title().trim())
                .description(safeTrim(req.description()))
                .category(req.category().trim().toUpperCase())
                .fileKind(req.fileKind().trim().toUpperCase())
                .sensitivity(req.sensitivity() == null ? "NORMAL"
                        : req.sensitivity().trim().toUpperCase())
                .version(1)
                .isActive(true)
                .instructions(safeTrim(req.instructions()))
                .createdById(caller.getId())
                .build();
        return toDto(repository.save(t));
    }

    @Transactional
    public DocumentTemplateDto update(UUID id, UpdateTemplateRequest req, User caller) {
        requireErm(caller);
        if (req == null) throw new BadRequestException("body is required");
        DocumentTemplate t = mustLoad(id);
        if (req.description() != null) t.setDescription(safeTrim(req.description()));
        if (req.category() != null && !req.category().isBlank()) {
            t.setCategory(req.category().trim().toUpperCase());
        }
        if (req.fileKind() != null) t.setFileKind(req.fileKind().trim().toUpperCase());
        if (req.sensitivity() != null) {
            t.setSensitivity(req.sensitivity().trim().toUpperCase());
        }
        if (req.instructions() != null) t.setInstructions(safeTrim(req.instructions()));
        return toDto(repository.save(t));
    }

    @Transactional
    public DocumentTemplateDto uploadFile(UUID id, MultipartFile file, User caller) {
        requireErm(caller);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("file is required");
        }
        if (file.getSize() > MAX_TEMPLATE_FILE_BYTES) {
            throw new BadRequestException("Template file exceeds 10 MB limit");
        }
        String mime = file.getContentType();
        if (mime != null && !ALLOWED_MIME.contains(mime)) {
            throw new BadRequestException(
                    "Unsupported template MIME (allowed: PDF, DOCX, XLSX). Got: " + mime);
        }
        DocumentTemplate t = mustLoad(id);
        try {
            byte[] bytes = file.getBytes();
            Document doc = documentVault.saveDocument(
                    caller.getId(),
                    file.getOriginalFilename(),
                    mime,
                    bytes,
                    "TEMPLATE",
                    t.getSensitivity(),
                    caller.getId());
            // Bump version, retain prior file id for history.
            if (t.getTemplateFileId() != null) {
                t.setPreviousVersionFileId(t.getTemplateFileId());
                t.setVersion(t.getVersion() == null ? 2 : t.getVersion() + 1);
            }
            t.setTemplateFileId(doc.getId());
            return toDto(repository.save(t));
        } catch (Exception e) {
            log.warn("[DocumentTemplate] file upload failed: {}", e.getMessage());
            throw new RuntimeException("Template file upload failed: " + e.getMessage(), e);
        }
    }

    @Transactional
    public DocumentTemplateDto deactivate(UUID id, User caller) {
        requireErm(caller);
        DocumentTemplate t = mustLoad(id);
        t.setIsActive(false);
        return toDto(repository.save(t));
    }

    @Transactional
    public DocumentTemplateDto reactivate(UUID id, User caller) {
        requireErm(caller);
        DocumentTemplate t = mustLoad(id);
        t.setIsActive(true);
        return toDto(repository.save(t));
    }

    /** Streams the template file bytes to the caller. ERM-only call —
     *  the intern download path goes through InternDocumentService so
     *  it audit-logs against the task, not just the template. */
    @Transactional
    public byte[] downloadAsErm(UUID id, User caller) {
        requireErm(caller);
        DocumentTemplate t = mustLoad(id);
        if (t.getTemplateFileId() == null) {
            throw new ResourceNotFoundException(
                    "Template '" + t.getTitle() + "' has no file uploaded yet");
        }
        return documentVault.readDocument(t.getTemplateFileId(), caller);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private DocumentTemplate mustLoad(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "DocumentTemplate not found: " + id));
    }

    private void requireErm(User caller) {
        if (caller == null) throw new ForbiddenException("Caller required");
        if (!caller.getRoles().contains(UserRole.ERM)
                && !caller.getRoles().contains(UserRole.SUPER_ADMIN)) {
            throw new ForbiddenException("ERM or SUPER_ADMIN required");
        }
    }

    private DocumentTemplateDto toDto(DocumentTemplate t) {
        Document file = t.getTemplateFileId() != null
                ? documentRepository.findById(t.getTemplateFileId()).orElse(null) : null;
        String createdByName = null;
        if (t.getCreatedById() != null) {
            createdByName = userRepository.findById(t.getCreatedById())
                    .map(u -> u.getFullName()).orElse(null);
        }
        long usage = safeCount(
                "SELECT COUNT(*) FROM document_tasks "
                        + " WHERE template_id = ? AND status <> 'WAIVED'",
                t.getId());
        return new DocumentTemplateDto(
                t.getId(), t.getTitle(), t.getDescription(), t.getCategory(),
                t.getFileKind(), t.getSensitivity(), t.getVersion(),
                t.getTemplateFileId(),
                file != null ? file.getFileName() : null,
                file != null ? file.getFileSize() : null,
                t.getPreviousVersionFileId(),
                t.getIsActive(),
                t.getInstructions(),
                t.getCreatedById(), createdByName,
                t.getCreatedAt(), t.getUpdatedAt(),
                usage);
    }

    private long safeCount(String sql, Object... params) {
        try {
            Long c = jdbc.queryForObject(sql, Long.class, params);
            return c == null ? 0L : c;
        } catch (Exception e) {
            return 0L;
        }
    }

    private static String safeTrim(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
