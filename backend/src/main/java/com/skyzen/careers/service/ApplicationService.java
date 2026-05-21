package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.application.ApplicationLifecycle;
import com.skyzen.careers.dto.ApplicationCreateRequest;
import com.skyzen.careers.dto.ApplicationResponse;
import com.skyzen.careers.dto.ApplicationStatusUpdateRequest;
import com.skyzen.careers.dto.BulkApplicationActionRequest;
import com.skyzen.careers.dto.BulkApplicationActionResponse;
import com.skyzen.careers.dto.RecruiterDecisionRequest;
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
import com.skyzen.careers.repository.ApplicationSpecifications;
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
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

    /**
     * Staff applications list with composable filters + sorting + paging.
     * Backed by a JPA Specification that fetch-joins candidate→user and
     * jobPosting→entity so the DTO mapper never lazy-loads / N+1's.
     *
     * @param search      case-insensitive substring match on candidate
     *                    fullName OR email; null/blank to skip
     * @param statuses    optional set of statuses; null/empty to skip
     * @param entityId    optional StaffingEntity id filter
     * @param jobPostingId optional JobPosting id filter
     */
    @Transactional(readOnly = true)
    public Page<ApplicationResponse> search(String search,
                                            Collection<ApplicationStatus> statuses,
                                            UUID entityId,
                                            UUID jobPostingId,
                                            Pageable pageable) {
        return applicationRepository
                .findAll(ApplicationSpecifications.withFilters(search, statuses, entityId, jobPostingId),
                        pageable)
                .map(this::toResponse);
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
        if (req.getRecruiterNotes() != null) {
            application.setRecruiterNotes(req.getRecruiterNotes());
        }
        // transitionTo is gated by LEGAL_TRANSITIONS — illegal Kanban drags
        // throw BadRequestException (400) rather than corrupting state.
        transitionTo(application, req.getStatus(), "STATUS_CHANGE", caller);
        return toResponse(application);
    }

    /**
     * Gated status transition — the single entry point that every status
     * write-site MUST go through. Checks {@link ApplicationLifecycle#LEGAL_TRANSITIONS},
     * sets status/statusUpdatedAt/statusUpdatedBy, persists the row, and writes
     * exactly ONE audit log entry. Same-state target is a legal no-op (no save,
     * no audit). Illegal target throws {@link BadRequestException} → 400.
     */
    @Transactional
    public Application transitionTo(Application app,
                                    ApplicationStatus target,
                                    String auditAction,
                                    User actor) {
        ApplicationStatus from = app.getStatus();
        if (from == target) return app; // legal no-op
        Set<ApplicationStatus> allowed =
                ApplicationLifecycle.LEGAL_TRANSITIONS.getOrDefault(from, Collections.emptySet());
        if (!allowed.contains(target)) {
            throw new BadRequestException(
                    "Cannot move application from " + from + " to " + target);
        }
        return applyTransition(app, from, target, auditAction,
                actor != null ? actor.getId() : null);
    }

    /**
     * Override path — bypasses {@link ApplicationLifecycle#LEGAL_TRANSITIONS}
     * but STILL audits. Reserved for SYSTEM (boot-time backfill) and ADMIN
     * corrections that need to break the normal lifecycle. Same-state remains
     * a no-op. Callers must justify why the gated path is wrong for them.
     */
    @Transactional
    public Application transitionToSystem(Application app,
                                          ApplicationStatus target,
                                          String auditAction,
                                          UUID actorId) {
        ApplicationStatus from = app.getStatus();
        if (from == target) return app;
        return applyTransition(app, from, target, auditAction, actorId);
    }

    private Application applyTransition(Application app,
                                        ApplicationStatus from,
                                        ApplicationStatus target,
                                        String auditAction,
                                        UUID actorId) {
        app.setStatus(target);
        app.setStatusUpdatedAt(Instant.now());
        app.setStatusUpdatedBy(actorId);
        Application saved = applicationRepository.save(app);
        writeStatusAudit(saved.getId(), auditAction, actorId, from, target);
        return saved;
    }

    /**
     * One-click Shortlist from the recruiter review screen. Routes through
     * {@link #transitionTo} so the lifecycle guard + audit are uniform with
     * the Kanban drag. Persists rating/note. Idempotent: if already
     * SHORTLISTED the rating/note are still applied but no audit row is written.
     */
    @Transactional
    public ApplicationResponse shortlist(UUID id, RecruiterDecisionRequest req, User caller) {
        return changeStatusWithAudit(id, ApplicationStatus.SHORTLISTED, "SHORTLIST", req, caller);
    }

    /** Mirror of {@link #shortlist} for one-click rejection. Writes a REJECT audit entry. */
    @Transactional
    public ApplicationResponse reject(UUID id, RecruiterDecisionRequest req, User caller) {
        return changeStatusWithAudit(id, ApplicationStatus.REJECTED, "REJECT", req, caller);
    }

    /**
     * Bulk variant of {@link #shortlist} / {@link #reject}. Loops the existing
     * single-id path per application so audit + statusUpdatedAt + side-effects
     * stay consistent with one-by-one usage. Idempotent: ids already at the
     * target status (or not found) are counted into {@code skipped}; only real
     * transitions count toward {@code updated}. Per-row {@link BadRequestException}
     * (illegal transition for that row) is also counted as skipped — one
     * terminal-state row should not fail the whole batch.
     */
    @Transactional
    public BulkApplicationActionResponse bulkAction(BulkApplicationActionRequest req, User caller) {
        ApplicationStatus target = req.getAction() == BulkApplicationActionRequest.BulkAction.SHORTLIST
                ? ApplicationStatus.SHORTLISTED
                : ApplicationStatus.REJECTED;
        String auditAction = req.getAction() == BulkApplicationActionRequest.BulkAction.SHORTLIST
                ? "SHORTLIST"
                : "REJECT";

        // Pre-fetch once so we can pre-check the target status without N+1.
        List<Application> apps = applicationRepository.findAllById(req.getIds());
        Map<UUID, Application> byId = new HashMap<>();
        for (Application a : apps) byId.put(a.getId(), a);

        int updated = 0;
        int skipped = 0;
        for (UUID id : req.getIds()) {
            Application app = byId.get(id);
            if (app == null) {
                // Unknown id — count as skipped rather than failing the whole batch.
                skipped++;
                continue;
            }
            if (app.getStatus() == target) {
                skipped++;
                continue;
            }
            try {
                changeStatusWithAudit(id, target, auditAction, null, caller);
                updated++;
            } catch (BadRequestException illegal) {
                // Terminal/illegal source state — keep the batch going.
                skipped++;
            }
        }
        return BulkApplicationActionResponse.builder()
                .updated(updated)
                .skipped(skipped)
                .build();
    }

    private ApplicationResponse changeStatusWithAudit(UUID id,
                                                      ApplicationStatus target,
                                                      String action,
                                                      RecruiterDecisionRequest decision,
                                                      User caller) {
        Application application = applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + id));
        boolean idempotent = (application.getStatus() == target);

        // Persist rating + note even on an idempotent call so recruiters can refine
        // their decision without forcing a status flip.
        applyDecisionFields(application, decision, caller);

        if (idempotent) {
            applicationRepository.save(application);
            return toResponse(application);
        }
        transitionTo(application, target, action, caller);
        return toResponse(application);
    }

    private void applyDecisionFields(Application app,
                                     RecruiterDecisionRequest decision,
                                     User caller) {
        if (decision == null) return;
        if (decision.getRating() != null) {
            app.setRecruiterRating(decision.getRating());
        }
        if (decision.getNote() != null) {
            // The note field on the entity is the existing recruiterNotes column —
            // spec calls it "recruiterNote" but reusing the existing column avoids
            // duplicate state. The wire DTO names match the spec; the storage name doesn't.
            app.setRecruiterNotes(decision.getNote());
        }
        if (caller != null) {
            app.setStatusUpdatedBy(caller.getId());
        }
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
                .recruiterRating(a.getRecruiterRating())
                .build();
    }
}
