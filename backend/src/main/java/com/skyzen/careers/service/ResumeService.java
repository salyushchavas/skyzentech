package com.skyzen.careers.service;

import com.skyzen.careers.dto.ResumeResponse;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Resume;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.ResumeRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResumeService {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    private final ResumeRepository resumeRepository;
    private final CandidateRepository candidateRepository;
    private final ApplicationRepository applicationRepository;

    @Value("${app.resume.storage-path:./uploads/resumes}")
    private String storagePath;

    private Path storageDir;

    @PostConstruct
    void initStorage() {
        try {
            storageDir = Paths.get(storagePath).toAbsolutePath().normalize();
            Files.createDirectories(storageDir);
            log.info("Resume storage directory initialized at: {}", storageDir);
        } catch (IOException e) {
            log.error("Failed to initialize resume storage directory at {}", storagePath, e);
            throw new IllegalStateException("Cannot initialize resume storage directory", e);
        }
    }

    @Transactional
    public ResumeResponse upload(User user, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Resume file is required");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new BadRequestException(
                    "Unsupported content type. Allowed: pdf, doc, docx");
        }

        // Lazy-create Candidate if missing — same safety net ApplicationService uses.
        // Newly registered candidates can hit upload before any code path materializes
        // their Candidate row.
        Candidate candidate = candidateRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    log.warn("Lazy-creating Candidate for user {} during resume upload",
                            user.getId());
                    return candidateRepository.save(
                            Candidate.builder().user(user).build());
                });

        String originalName = file.getOriginalFilename() != null
                ? file.getOriginalFilename() : "resume";
        String extension = extractExtension(originalName, contentType);
        String stored = UUID.randomUUID() + extension;

        // Defensive: ensure storage directory exists at write-time. @PostConstruct
        // creates it at startup, but Railway's filesystem can be ephemeral on
        // restart — and if the dir is gone, Files.copy throws NoSuchFileException.
        try {
            Files.createDirectories(storageDir);
        } catch (IOException e) {
            log.error("Failed to ensure resume storage directory exists at {}: {}",
                    storageDir, e.getMessage(), e);
            throw new RuntimeException("Could not prepare resume storage directory", e);
        }

        Path target = storageDir.resolve(stored);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("Failed to write resume file to {}: {}",
                    storageDir, e.getMessage(), e);
            throw new RuntimeException("Could not save resume file", e);
        }

        boolean isFirst = resumeRepository.countByCandidateId(candidate.getId()) == 0;

        Resume resume = Resume.builder()
                .candidate(candidate)
                .fileName(originalName)
                .storedFileName(stored)
                .filePath(target.toString())
                .fileSize(file.getSize())
                .contentType(contentType)
                .fileUrl(stored)
                .isDefault(isFirst)
                .version(1)
                .build();
        resume = resumeRepository.save(resume);

        if (isFirst) {
            candidate.setDefaultResumeId(resume.getId());
            candidateRepository.save(candidate);
        }
        return toResponse(resume);
    }

    @Transactional(readOnly = true)
    public List<ResumeResponse> listForUser(UUID userId) {
        Candidate candidate = candidateRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate profile not found for user " + userId));
        return resumeRepository.findByCandidateId(candidate.getId())
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public ResumeResponse setDefault(UUID userId, UUID resumeId) {
        Resume resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new ResourceNotFoundException("Resume not found: " + resumeId));
        Candidate candidate = candidateRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate profile not found for user " + userId));
        if (!resume.getCandidate().getId().equals(candidate.getId())) {
            throw new ForbiddenException("Resume does not belong to this user");
        }
        resumeRepository.clearDefaultForOtherResumes(candidate.getId(), resume.getId());
        resume.setIsDefault(true);
        candidate.setDefaultResumeId(resume.getId());
        candidateRepository.save(candidate);
        return toResponse(resume);
    }

    @Transactional
    public void delete(UUID userId, UUID resumeId, boolean isCandidate) {
        Resume resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new ResourceNotFoundException("Resume not found: " + resumeId));
        if (isCandidate) {
            Candidate candidate = candidateRepository.findByUserId(userId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Candidate profile not found for user " + userId));
            if (!resume.getCandidate().getId().equals(candidate.getId())) {
                throw new ForbiddenException("Resume does not belong to this user");
            }
        }
        if (applicationRepository.existsByResumeId(resume.getId())) {
            throw new ConflictException("Cannot delete a resume that is referenced by an application");
        }
        try {
            if (resume.getFilePath() != null) {
                Files.deleteIfExists(Paths.get(resume.getFilePath()));
            }
        } catch (IOException e) {
            log.warn("Failed to delete resume file {}: {}", resume.getFilePath(), e.getMessage());
        }
        resumeRepository.delete(resume);
    }

    @Transactional(readOnly = true)
    public Resume loadEntity(UUID resumeId) {
        return resumeRepository.findById(resumeId)
                .orElseThrow(() -> new ResourceNotFoundException("Resume not found: " + resumeId));
    }

    public FileSystemResource loadFile(Resume resume) {
        // Resolve from the CURRENT storage path config + the stored filename, not
        // the absolute filePath captured at upload time. This survives Railway-style
        // FS path changes between deploys, and keeps the lookup consistent with
        // resume.storedFileName as the canonical identifier on disk.
        if (resume.getStoredFileName() == null || resume.getStoredFileName().isBlank()) {
            log.warn("Resume {} has no storedFileName — cannot serve file", resume.getId());
            throw new ResourceNotFoundException("Resume file not available");
        }
        Path path = storageDir.resolve(resume.getStoredFileName());
        if (!Files.exists(path)) {
            // Clean 404, not a 500. The frontend surfaces this as "Resume file not available".
            log.warn("Resume file not on disk: {}", path);
            throw new ResourceNotFoundException("Resume file not available");
        }
        return new FileSystemResource(path.toFile());
    }

    public ResumeResponse toResponse(Resume r) {
        return ResumeResponse.builder()
                .id(r.getId())
                .fileName(r.getFileName())
                .fileSize(r.getFileSize())
                .contentType(r.getContentType())
                .isDefault(r.getIsDefault())
                .createdAt(r.getCreatedAt())
                .build();
    }

    private String extractExtension(String filename, String contentType) {
        int dot = filename.lastIndexOf('.');
        if (dot > 0 && dot < filename.length() - 1) {
            String ext = filename.substring(dot).toLowerCase();
            if (ext.matches("\\.(pdf|doc|docx)")) {
                return ext;
            }
        }
        return switch (contentType) {
            case "application/pdf" -> ".pdf";
            case "application/msword" -> ".doc";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> ".docx";
            default -> "";
        };
    }
}
