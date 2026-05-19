package com.skyzen.careers.service;

import com.skyzen.careers.dto.JobPostingCreateRequest;
import com.skyzen.careers.dto.JobPostingResponse;
import com.skyzen.careers.dto.JobPostingUpdateRequest;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.JobPostingStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.JobPostingRepository;
import com.skyzen.careers.repository.StaffingEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JobPostingService {

    private final JobPostingRepository jobPostingRepository;
    private final StaffingEntityRepository staffingEntityRepository;

    @Transactional(readOnly = true)
    public Page<JobPostingResponse> listOpen(Pageable pageable) {
        return jobPostingRepository.findByStatus(JobPostingStatus.OPEN, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<JobPostingResponse> listAll(Pageable pageable) {
        return jobPostingRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public JobPostingResponse findPublicByIdOrSlug(String idOrSlug,
                                                   com.skyzen.careers.entity.User viewer) {
        JobPosting posting = lookupByIdOrSlug(idOrSlug);
        boolean privileged = viewer != null
                && (viewer.getRoles().contains(UserRole.ADMIN)
                || viewer.getRoles().contains(UserRole.ERM));
        if (!privileged && posting.getStatus() != JobPostingStatus.OPEN) {
            throw new ResourceNotFoundException("Job posting not found");
        }
        return toResponse(posting);
    }

    @Transactional(readOnly = true)
    public JobPostingResponse findAnyByIdOrSlug(String idOrSlug) {
        return toResponse(lookupByIdOrSlug(idOrSlug));
    }

    @Transactional
    public JobPostingResponse create(JobPostingCreateRequest req, User publisher) {
        StaffingEntity entity = staffingEntityRepository.findById(req.getEntityId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "StaffingEntity not found: " + req.getEntityId()));

        JobPosting posting = JobPosting.builder()
                .entity(entity)
                .title(req.getTitle())
                .description(req.getDescription())
                .requirements(req.getRequirements())
                .location(req.getLocation())
                .employmentType(req.getEmploymentType())
                .status(JobPostingStatus.DRAFT)
                .slug(generateUniqueSlug(req.getTitle()))
                .publishedById(publisher != null ? publisher.getId() : null)
                .build();
        posting = jobPostingRepository.save(posting);
        return toResponse(posting);
    }

    @Transactional
    public JobPostingResponse update(UUID id, JobPostingUpdateRequest req) {
        JobPosting posting = jobPostingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job posting not found: " + id));

        if (req.getTitle() != null) posting.setTitle(req.getTitle());
        if (req.getDescription() != null) posting.setDescription(req.getDescription());
        if (req.getRequirements() != null) posting.setRequirements(req.getRequirements());
        if (req.getLocation() != null) posting.setLocation(req.getLocation());
        if (req.getEmploymentType() != null) posting.setEmploymentType(req.getEmploymentType());
        if (req.getStatus() != null) {
            applyStatusTransition(posting, req.getStatus());
        }
        return toResponse(posting);
    }

    @Transactional
    public JobPostingResponse updateStatus(UUID id, JobPostingStatus status) {
        JobPosting posting = jobPostingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job posting not found: " + id));
        applyStatusTransition(posting, status);
        return toResponse(posting);
    }

    private void applyStatusTransition(JobPosting posting, JobPostingStatus newStatus) {
        boolean firstPublish = newStatus == JobPostingStatus.OPEN && posting.getPublishedAt() == null;
        posting.setStatus(newStatus);
        if (firstPublish) {
            posting.setPublishedAt(Instant.now());
        }
    }

    private JobPosting lookupByIdOrSlug(String idOrSlug) {
        UUID uuid = tryParseUuid(idOrSlug);
        if (uuid != null) {
            return jobPostingRepository.findById(uuid)
                    .orElseThrow(() -> new ResourceNotFoundException("Job posting not found: " + idOrSlug));
        }
        return jobPostingRepository.findBySlug(idOrSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Job posting not found: " + idOrSlug));
    }

    private UUID tryParseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String generateUniqueSlug(String title) {
        String base = slugify(title);
        if (base.isEmpty()) {
            base = "job-posting";
        }
        if (!jobPostingRepository.existsBySlug(base)) {
            return base;
        }
        for (int i = 0; i < 5; i++) {
            String suffix = randomSuffix();
            String candidate = base + "-" + suffix;
            if (!jobPostingRepository.existsBySlug(candidate)) {
                return candidate;
            }
        }
        return base + "-" + UUID.randomUUID();
    }

    private String slugify(String input) {
        if (input == null) return "";
        String lower = input.toLowerCase(Locale.ROOT).trim();
        String replaced = lower.replaceAll("[^a-z0-9]+", "-");
        replaced = replaced.replaceAll("(^-+|-+$)", "");
        if (replaced.length() > 80) {
            replaced = replaced.substring(0, 80).replaceAll("-+$", "");
        }
        return replaced;
    }

    private String randomSuffix() {
        String hex = Long.toHexString(System.nanoTime() ^ Double.doubleToLongBits(Math.random()));
        return hex.substring(Math.max(0, hex.length() - 4));
    }

    public JobPostingResponse toResponse(JobPosting p) {
        return JobPostingResponse.builder()
                .id(p.getId())
                .slug(p.getSlug())
                .title(p.getTitle())
                .description(p.getDescription())
                .requirements(p.getRequirements())
                .location(p.getLocation())
                .employmentType(p.getEmploymentType())
                .status(p.getStatus())
                .entityName(p.getEntity() != null ? p.getEntity().getName() : null)
                .publishedAt(p.getPublishedAt())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
