package com.skyzen.careers.service;

import com.skyzen.careers.dto.ResumeResponse;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Resume;
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
    public ResumeResponse upload(UUID userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Resume file is required");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new BadRequestException(
                    "Unsupported content type. Allowed: pdf, doc, docx");
        }

        Candidate candidate = candidateRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate profile not found for user " + userId));

        String originalName = file.getOriginalFilename() != null
                ? file.getOriginalFilename() : "resume";
        String extension = extractExtension(originalName, contentType);
        String stored = UUID.randomUUID() + extension;
        Path target = storageDir.resolve(stored);

        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("Failed to write resume file to {}", target, e);
            throw new BadRequestException("Failed to store resume file");
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
        if (resume.getFilePath() == null) {
            throw new ResourceNotFoundException("Resume file path missing");
        }
        Path path = Paths.get(resume.getFilePath());
        if (!Files.exists(path)) {
            throw new ResourceNotFoundException("Resume file is no longer available on disk");
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
