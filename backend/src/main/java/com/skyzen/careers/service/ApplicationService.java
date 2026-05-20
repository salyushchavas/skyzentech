package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.ApplicationCreateRequest;
import com.skyzen.careers.dto.ApplicationResponse;
import com.skyzen.careers.dto.ApplicationStatusUpdateRequest;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Resume;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.JobPostingStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.JobPostingRepository;
import com.skyzen.careers.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final JobPostingRepository jobPostingRepository;
    private final ResumeRepository resumeRepository;
    private final CandidateRepository candidateRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ApplicationResponse apply(User user, ApplicationCreateRequest req) {
        Candidate candidate = candidateRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    log.warn("Lazy-creating Candidate for user {} during application submit", user.getId());
                    return candidateRepository.save(Candidate.builder().user(user).build());
                });

        JobPosting posting = jobPostingRepository.findById(req.getJobPostingId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Job posting not found: " + req.getJobPostingId()));
        if (posting.getStatus() != JobPostingStatus.OPEN) {
            throw new BadRequestException("Job posting is not open for applications");
        }

        Resume resume = resumeRepository.findById(req.getResumeId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Resume not found: " + req.getResumeId()));
        if (!resume.getCandidate().getId().equals(candidate.getId())) {
            throw new ForbiddenException("Resume does not belong to this user");
        }

        if (applicationRepository.existsByCandidateIdAndJobPostingId(candidate.getId(), posting.getId())) {
            throw new ConflictException("Already applied to this job posting");
        }

        Application application = Application.builder()
                .candidate(candidate)
                .jobPosting(posting)
                .resume(resume)
                .status(ApplicationStatus.APPLIED)
                .build();
        application = applicationRepository.save(application);
        return toResponse(application);
    }

    @Transactional(readOnly = true)
    public java.util.List<ApplicationResponse> listForCandidate(User user) {
        Candidate candidate = candidateRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate profile not found for user " + user.getId()));
        return applicationRepository.findByCandidateId(candidate.getId())
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public Page<ApplicationResponse> search(ApplicationStatus status, UUID jobPostingId, Pageable pageable) {
        return applicationRepository.search(status, jobPostingId, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ApplicationResponse findById(UUID id, User caller) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + id));
        ensureCanRead(application, caller);
        return toResponse(application);
    }

    @Transactional(readOnly = true)
    public Application findEntityForRead(UUID id, User caller) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + id));
        ensureCanRead(application, caller);
        return application;
    }

    @Transactional
    public ApplicationResponse updateStatus(UUID id, ApplicationStatusUpdateRequest req, User caller) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + id));
        application.setStatus(req.getStatus());
        application.setStatusUpdatedAt(Instant.now());
        application.setStatusUpdatedBy(caller != null ? caller.getId() : null);
        if (req.getRecruiterNotes() != null) {
            application.setRecruiterNotes(req.getRecruiterNotes());
        }
        return toResponse(application);
    }

    /**
     * Thin convenience wrapper for the recruiter review screen's one-click action.
     * Routes through {@link #updateStatus} so transition behaviour stays consistent
     * with the Kanban drag, then writes a "SHORTLIST" audit entry. Idempotent: if
     * the application is already SHORTLISTED, returns 200 without re-auditing.
     */
    @Transactional
    public ApplicationResponse shortlist(UUID id, User caller) {
        return changeStatusWithAudit(id, ApplicationStatus.SHORTLISTED, "SHORTLIST", caller);
    }

    /**
     * Mirror of {@link #shortlist} for one-click rejection. Writes a "REJECT" audit entry.
     * Idempotent: if already REJECTED, no audit row is written.
     */
    @Transactional
    public ApplicationResponse reject(UUID id, User caller) {
        return changeStatusWithAudit(id, ApplicationStatus.REJECTED, "REJECT", caller);
    }

    private ApplicationResponse changeStatusWithAudit(UUID id,
                                                      ApplicationStatus target,
                                                      String action,
                                                      User caller) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + id));
        ApplicationStatus before = application.getStatus();
        if (before == target) {
            // Idempotent — already in target status; skip the audit write.
            return toResponse(application);
        }
        ApplicationStatusUpdateRequest req = new ApplicationStatusUpdateRequest();
        req.setStatus(target);
        ApplicationResponse response = updateStatus(id, req, caller);
        writeStatusAudit(id, action, caller != null ? caller.getId() : null, before, target);
        return response;
    }

    private void writeStatusAudit(UUID applicationId, String action, UUID userId,
                                  ApplicationStatus before, ApplicationStatus after) {
        Map<String, Object> beforeJson = new LinkedHashMap<>();
        beforeJson.put("status", before);
        Map<String, Object> afterJson = new LinkedHashMap<>();
        afterJson.put("status", after);
        AuditLog entry = AuditLog.builder()
                .entityType("Application")
                .entityId(applicationId)
                .action(action)
                .userId(userId)
                .beforeJson(serializeJson(beforeJson))
                .afterJson(serializeJson(afterJson))
                .build();
        auditLogRepository.save(entry);
    }

    private String serializeJson(Map<String, Object> snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize application audit snapshot: {}", e.getMessage());
            return new HashMap<>(snapshot).toString();
        }
    }

    private void ensureCanRead(Application application, User caller) {
        if (caller == null) {
            throw new ForbiddenException("Authentication required");
        }
        boolean privileged = caller.getRoles().contains(UserRole.ADMIN)
                || caller.getRoles().contains(UserRole.RECRUITER)
                || caller.getRoles().contains(UserRole.ERM);
        if (privileged) return;

        if (caller.getRoles().contains(UserRole.CANDIDATE)
                && application.getCandidate() != null
                && application.getCandidate().getUser() != null
                && application.getCandidate().getUser().getId().equals(caller.getId())) {
            return;
        }
        throw new ForbiddenException("Not allowed to view this application");
    }

    public ApplicationResponse toResponse(Application a) {
        Candidate c = a.getCandidate();
        User u = c != null ? c.getUser() : null;
        JobPosting jp = a.getJobPosting();
        Resume r = a.getResume();
        return ApplicationResponse.builder()
                .id(a.getId())
                .candidateName(u != null ? u.getFullName() : null)
                .candidateEmail(u != null ? u.getEmail() : null)
                .jobPostingTitle(jp != null ? jp.getTitle() : null)
                .jobPostingId(jp != null ? jp.getId() : null)
                .resumeId(r != null ? r.getId() : null)
                .resumeFileName(r != null ? r.getFileName() : null)
                .status(a.getStatus())
                .appliedAt(a.getAppliedAt())
                .statusUpdatedAt(a.getStatusUpdatedAt())
                .recruiterNotes(a.getRecruiterNotes())
                .build();
    }
}
