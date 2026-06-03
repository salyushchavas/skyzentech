package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.project.CreateProjectRequest;
import com.skyzen.careers.dto.project.ProjectResponse;
import com.skyzen.careers.dto.project.ProjectSubmissionResponse;
import com.skyzen.careers.dto.project.ProjectTaskResponse;
import com.skyzen.careers.dto.project.ReviewProjectRequest;
import com.skyzen.careers.dto.project.SubmitProjectRequest;
import com.skyzen.careers.dto.project.UpdateProgressRequest;
import com.skyzen.careers.dto.project.UpdateProjectRequest;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.ProjectSubmission;
import com.skyzen.careers.entity.ProjectTask;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.ProjectStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.ProjectRepository;
import com.skyzen.careers.repository.ProjectSubmissionRepository;
import com.skyzen.careers.repository.ProjectTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Project workspace service. Three lanes:
 *
 * <h3>Supervisor</h3>
 * <ul>
 *   <li>{@link #create} — assign to one of THEIR interns (engagement.supervisor
 *       check; SUPER_ADMIN bypasses)</li>
 *   <li>{@link #update} — edit fields + replace task list; blocked when COMPLETED</li>
 *   <li>{@link #returnForChanges} — RETURN with required notes (audit row)</li>
 *   <li>{@link #complete} — terminal lock (audit row)</li>
 * </ul>
 *
 * <h3>Intern</h3>
 * <ul>
 *   <li>{@link #start} — NOT_STARTED → IN_PROGRESS, stamps started_at</li>
 *   <li>{@link #updateProgress} — progress_pct + task done flips; no status change</li>
 *   <li>{@link #submit} — SUBMITTED + new ProjectSubmission row + audit</li>
 *   <li>Intern CANNOT call {@link #complete} or {@link #returnForChanges}.</li>
 * </ul>
 *
 * <h3>Audit actions</h3>
 * PROJECT_ASSIGNED / PROJECT_STARTED / PROJECT_SUBMITTED / PROJECT_RETURNED /
 * PROJECT_COMPLETED. Best-effort writes (a failure logs WARN and never blocks
 * the mutation).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProjectService {

    private static final TypeReference<List<String>> STRING_LIST_TYPE =
            new TypeReference<>() {};

    private final ProjectRepository projectRepository;
    private final ProjectTaskRepository projectTaskRepository;
    private final ProjectSubmissionRepository projectSubmissionRepository;
    private final CandidateRepository candidateRepository;
    private final EngagementRepository engagementRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final com.skyzen.careers.notification.NotificationService notificationService;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    // ── Supervisor: allocate ────────────────────────────────────────────────

    @Transactional
    public ProjectResponse create(CreateProjectRequest req, User actor) {
        Candidate intern = candidateRepository.findById(req.getCandidateId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + req.getCandidateId()));

        // Resolve the intern's engagement; supervisor must own it (or
        // SUPER_ADMIN). We pick the newest in-funnel (non-terminated)
        // engagement — same rule the weekly cycle uses.
        Engagement engagement = engagementRepository.findByCandidateId(intern.getId()).stream()
                .filter(e -> e.getStatus() != EngagementStatus.TERMINATED)
                .max(Comparator.comparing(Engagement::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElseThrow(() -> new BadRequestException(
                        "Intern has no active engagement — can't allocate a project."));

        ensureSupervisorOwnsEngagement(engagement, actor);

        Project project = Project.builder()
                .title(req.getTitle())
                .description(req.getDescription())
                .deliverables(req.getDeliverables())
                .resourceLinksJson(serializeList(req.getResourceLinks()))
                .engagement(engagement)
                .intern(intern)
                .assignedBy(actor)
                .startDate(req.getStartDate())
                .dueDate(req.getDueDate())
                .status(ProjectStatus.NOT_STARTED)
                .progressPct(0)
                .build();
        project = projectRepository.save(project);
        replaceTasks(project, req.getTaskTitles());

        writeAudit(project.getId(), "PROJECT_ASSIGNED", actor.getId(), Map.of(
                "title", project.getTitle(),
                "candidateId", intern.getId(),
                "engagementId", engagement.getId()));

        // Batch-3 — intern gets a "new project assigned" email. Best-effort.
        Project saved = reload(project.getId());
        try {
            notificationService.sendProjectAssigned(saved);
        } catch (Exception e) {
            log.warn("PROJECT_ASSIGNED notify failed (non-fatal) for {}: {}",
                    saved.getId(), e.getMessage());
        }
        return toResponse(saved);
    }

    // ── Supervisor: edit ────────────────────────────────────────────────────

    @Transactional
    public ProjectResponse update(UUID projectId, UpdateProjectRequest req, User actor) {
        Project project = projectRepository.findByIdWithGraph(projectId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + projectId));
        ensureSupervisorOwnsProject(project, actor);
        if (project.getStatus() == ProjectStatus.COMPLETED) {
            throw new ConflictException(
                    "This project is COMPLETED and locked. Allocate a new one to extend.");
        }

        if (req.getTitle() != null) project.setTitle(req.getTitle());
        if (req.getDescription() != null) project.setDescription(req.getDescription());
        if (req.getDeliverables() != null) project.setDeliverables(req.getDeliverables());
        if (req.getResourceLinks() != null) {
            project.setResourceLinksJson(serializeList(req.getResourceLinks()));
        }
        if (req.getStartDate() != null) project.setStartDate(req.getStartDate());
        if (req.getDueDate() != null) project.setDueDate(req.getDueDate());

        project = projectRepository.save(project);
        if (req.getTaskTitles() != null) {
            replaceTasks(project, req.getTaskTitles());
        }
        return toResponse(reload(project.getId()));
    }

    // ── Supervisor: read intern roster ──────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProjectResponse> listForIntern(UUID candidateId, User actor) {
        Candidate intern = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + candidateId));
        ensureSupervisorCanReview(intern, actor);
        return projectRepository.findByInternIdWithGraph(intern.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    /** Supervisor's full allocation board (their own assignments). */
    @Transactional(readOnly = true)
    public List<ProjectResponse> listMine(User actor) {
        return projectRepository.findByAssignedByIdWithGraph(actor.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    // ── Supervisor: review ──────────────────────────────────────────────────

    @Transactional
    public ProjectResponse returnForChanges(UUID projectId, ReviewProjectRequest req, User actor) {
        Project project = requireForReview(projectId, actor);
        if (project.getStatus() == ProjectStatus.COMPLETED) {
            return toResponse(project); // idempotent — already locked
        }
        if (project.getStatus() == ProjectStatus.NOT_STARTED
                || project.getStatus() == ProjectStatus.IN_PROGRESS) {
            throw new BadRequestException(
                    "Can't return a project that hasn't been submitted yet.");
        }
        if (req == null || req.getReviewNotes() == null || req.getReviewNotes().isBlank()) {
            throw new BadRequestException(
                    "Review notes are required when returning a project for changes.");
        }
        project.setStatus(ProjectStatus.RETURNED);
        project.setReviewedBy(actor);
        project.setReviewedAt(Instant.now());
        project.setReviewNotes(req.getReviewNotes().trim());
        project = projectRepository.save(project);

        writeAudit(project.getId(), "PROJECT_RETURNED", actor.getId(), Map.of(
                "candidateId", project.getIntern().getId()));

        // Batch-3 — intern gets a "project returned" email with review notes.
        // Best-effort.
        Project saved = reload(project.getId());
        try {
            notificationService.sendProjectReturned(saved);
        } catch (Exception e) {
            log.warn("PROJECT_RETURNED notify failed (non-fatal) for {}: {}",
                    saved.getId(), e.getMessage());
        }
        return toResponse(saved);
    }

    @Transactional
    public ProjectResponse complete(UUID projectId, ReviewProjectRequest req, User actor) {
        Project project = requireForReview(projectId, actor);
        if (project.getStatus() == ProjectStatus.COMPLETED) {
            return toResponse(project); // idempotent re-click
        }
        if (project.getStatus() == ProjectStatus.NOT_STARTED
                || project.getStatus() == ProjectStatus.IN_PROGRESS) {
            throw new BadRequestException(
                    "Can't complete a project that hasn't been submitted yet.");
        }
        Instant now = Instant.now();
        project.setStatus(ProjectStatus.COMPLETED);
        project.setReviewedBy(actor);
        project.setReviewedAt(now);
        project.setCompletedAt(now);
        project.setProgressPct(100);
        if (req != null && req.getReviewNotes() != null && !req.getReviewNotes().isBlank()) {
            project.setReviewNotes(req.getReviewNotes().trim());
        }
        project = projectRepository.save(project);

        writeAudit(project.getId(), "PROJECT_COMPLETED", actor.getId(), Map.of(
                "candidateId", project.getIntern().getId()));

        // Batch-3 — intern gets a "project completed" email. Best-effort.
        Project saved = reload(project.getId());
        try {
            notificationService.sendProjectCompleted(saved);
        } catch (Exception e) {
            log.warn("PROJECT_COMPLETED notify failed (non-fatal) for {}: {}",
                    saved.getId(), e.getMessage());
        }

        // Two-role workflow prerequisite — emit ProjectCompletedEvent from
        // BOTH paths (this legacy single-reviewer complete + the
        // ProjectWorkflowService.completeAfterViva path) so downstream
        // listeners (offboarding, badges, portfolio link) don't need to
        // know which reviewer signed off.
        try {
            eventPublisher.publishEvent(
                    new com.skyzen.careers.event.project.ProjectCompletedEvent(
                            saved.getId(), actor != null ? actor.getId() : null));
        } catch (Exception e) {
            log.warn("ProjectCompletedEvent publish failed (non-fatal) for {}: {}",
                    saved.getId(), e.getMessage());
        }
        return toResponse(saved);
    }

    // ── Intern: read + lifecycle ────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProjectResponse> listForMe(User candidateUser) {
        Candidate candidate = candidateRepository.findByUserId(candidateUser.getId())
                .orElseThrow(() -> new ForbiddenException(
                        "Projects are visible to interns only."));
        return projectRepository.findByInternIdWithGraph(candidate.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ProjectResponse start(UUID projectId, User candidateUser) {
        Project project = requireInternOwned(projectId, candidateUser);
        if (project.getStatus() == ProjectStatus.COMPLETED) {
            throw new ConflictException(
                    "This project is completed and locked.");
        }
        if (project.getStatus() == ProjectStatus.NOT_STARTED) {
            project.setStatus(ProjectStatus.IN_PROGRESS);
            project.setStartedAt(Instant.now());
            project = projectRepository.save(project);
            writeAudit(project.getId(), "PROJECT_STARTED", candidateUser.getId(), Map.of(
                    "candidateId", project.getIntern().getId()));
        }
        return toResponse(reload(project.getId()));
    }

    @Transactional
    public ProjectResponse updateProgress(UUID projectId, UpdateProgressRequest req,
                                          User candidateUser) {
        Project project = requireInternOwned(projectId, candidateUser);
        if (project.getStatus() == ProjectStatus.COMPLETED) {
            throw new ConflictException(
                    "This project is completed and locked.");
        }
        // Auto-flip NOT_STARTED → IN_PROGRESS on first progress update.
        if (project.getStatus() == ProjectStatus.NOT_STARTED) {
            project.setStatus(ProjectStatus.IN_PROGRESS);
            project.setStartedAt(Instant.now());
        }
        if (req.getProgressPct() != null) {
            int clamped = Math.max(0, Math.min(100, req.getProgressPct()));
            project.setProgressPct(clamped);
        }
        if (req.getTaskUpdates() != null) {
            Map<UUID, ProjectTask> byId = new HashMap<>();
            for (ProjectTask t : projectTaskRepository
                    .findByProjectIdOrderBySortOrderAsc(project.getId())) {
                byId.put(t.getId(), t);
            }
            for (UpdateProgressRequest.TaskUpdate u : req.getTaskUpdates()) {
                if (u.getTaskId() == null || u.getDone() == null) continue;
                ProjectTask task = byId.get(u.getTaskId());
                if (task == null) continue; // wrong project — silently ignored
                task.setDone(u.getDone());
                projectTaskRepository.save(task);
            }
        }
        project = projectRepository.save(project);
        return toResponse(reload(project.getId()));
    }

    @Transactional
    public ProjectResponse submit(UUID projectId, SubmitProjectRequest req, User candidateUser) {
        Project project = requireInternOwned(projectId, candidateUser);
        if (project.getStatus() == ProjectStatus.COMPLETED) {
            throw new ConflictException(
                    "This project is completed and locked.");
        }
        if (project.getStatus() == ProjectStatus.NOT_STARTED) {
            project.setStatus(ProjectStatus.IN_PROGRESS);
            project.setStartedAt(Instant.now());
        }
        Instant now = Instant.now();
        project.setStatus(ProjectStatus.SUBMITTED);
        project.setSubmittedAt(now);
        project = projectRepository.save(project);

        ProjectSubmission sub = ProjectSubmission.builder()
                .project(project)
                .description(req != null ? req.getDescription() : null)
                .linksJson(req != null ? serializeList(req.getLinks()) : null)
                .submittedAt(now)
                .build();
        projectSubmissionRepository.save(sub);

        writeAudit(project.getId(), "PROJECT_SUBMITTED", candidateUser.getId(), Map.of(
                "candidateId", project.getIntern().getId()));

        // Batch-3 — supervisor gets a "project submitted by {intern}" email.
        // Best-effort.
        Project saved = reload(project.getId());
        try {
            notificationService.sendProjectSubmitted(saved);
        } catch (Exception e) {
            log.warn("PROJECT_SUBMITTED notify failed (non-fatal) for {}: {}",
                    saved.getId(), e.getMessage());
        }
        return toResponse(saved);
    }

    // ── Gate helpers ────────────────────────────────────────────────────────

    private Project requireForReview(UUID projectId, User actor) {
        Project project = projectRepository.findByIdWithGraph(projectId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + projectId));
        ensureSupervisorOwnsProject(project, actor);
        return project;
    }

    private Project requireInternOwned(UUID projectId, User candidateUser) {
        Project project = projectRepository.findByIdWithGraph(projectId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + projectId));
        Candidate candidate = candidateRepository.findByUserId(candidateUser.getId())
                .orElseThrow(() -> new ForbiddenException(
                        "Projects are visible to interns only."));
        if (project.getIntern() == null
                || !project.getIntern().getId().equals(candidate.getId())) {
            // Don't leak existence.
            throw new ResourceNotFoundException("Project not found: " + projectId);
        }
        // Active-engagement gate — mirrors weekly cycle.
        List<Engagement> active = engagementRepository
                .findByCandidateIdAndStatus(candidate.getId(), EngagementStatus.ACTIVE);
        if (active.isEmpty()) {
            throw new ForbiddenException(
                    "Projects can only be worked while your engagement is active.");
        }
        return project;
    }

    // Role-based gates — any TECHNICAL_EVALUATOR (or SUPER_ADMIN) may
    // allocate / review / mutate any project. Per-engagement supervisor FK
    // is informational metadata, not a permission boundary.
    private void ensureSupervisorOwnsEngagement(Engagement engagement, User actor) {
        ensureTechnicalSupervisorRole(actor);
    }

    private void ensureSupervisorOwnsProject(Project project, User actor) {
        ensureTechnicalSupervisorRole(actor);
    }

    private void ensureSupervisorCanReview(Candidate candidate, User actor) {
        ensureTechnicalSupervisorRole(actor);
    }

    private static void ensureTechnicalSupervisorRole(User actor) {
        if (actor == null) throw new ForbiddenException("Authentication required.");
        if (isSuperAdmin(actor)) return;
        if (actor.getRoles() != null
                && actor.getRoles().contains(UserRole.TECHNICAL_EVALUATOR)) {
            return;
        }
        throw new ForbiddenException(
                "Only TECHNICAL_EVALUATOR or SUPER_ADMIN may perform this action.");
    }

    private static boolean isSuperAdmin(User u) {
        return u.getRoles() != null && u.getRoles().contains(UserRole.SUPER_ADMIN);
    }

    // ── Internals ───────────────────────────────────────────────────────────

    private Project reload(UUID id) {
        return projectRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + id));
    }

    private void replaceTasks(Project project, List<String> taskTitles) {
        // Wipe + recreate. Project task ids change on edit — acceptable because
        // tasks have no foreign references and are intentionally lightweight.
        projectTaskRepository.deleteByProjectId(project.getId());
        if (taskTitles == null || taskTitles.isEmpty()) return;
        int order = 0;
        for (String title : taskTitles) {
            if (title == null || title.isBlank()) continue;
            ProjectTask task = ProjectTask.builder()
                    .project(project)
                    .title(title.trim())
                    .done(false)
                    .sortOrder(order++)
                    .build();
            projectTaskRepository.save(task);
        }
    }

    private void writeAudit(UUID projectId, String action, UUID userId,
                            Map<String, Object> snapshot) {
        Map<String, Object> after = snapshot != null
                ? new LinkedHashMap<>(snapshot) : new LinkedHashMap<>();
        AuditLog entry = AuditLog.builder()
                .entityType("Project")
                .entityId(projectId)
                .action(action)
                .userId(userId)
                .afterJson(serializeJson(after))
                .build();
        try {
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("Failed to write {} audit row (non-fatal): {}", action, e.getMessage());
        }
    }

    private String serializeJson(Map<String, Object> snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize project audit snapshot: {}", e.getMessage());
            return String.valueOf(snapshot);
        }
    }

    private String serializeList(List<String> values) {
        if (values == null || values.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize string list: {}", e.getMessage());
            return values.toString();
        }
    }

    private List<String> deserializeList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, STRING_LIST_TYPE);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse stored list JSON: {}", e.getMessage());
            return List.of();
        }
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private ProjectResponse toResponse(Project p) {
        List<ProjectTask> tasks = projectTaskRepository
                .findByProjectIdOrderBySortOrderAsc(p.getId());
        List<ProjectSubmission> submissions = projectSubmissionRepository
                .findByProjectIdOrderBySubmittedAtDesc(p.getId());

        Candidate intern = p.getIntern();
        User internUser = intern != null ? intern.getUser() : null;
        User assignedBy = p.getAssignedBy();
        User reviewedBy = p.getReviewedBy();

        return ProjectResponse.builder()
                .id(p.getId())
                .title(p.getTitle())
                .description(p.getDescription())
                .deliverables(p.getDeliverables())
                .resourceLinks(deserializeList(p.getResourceLinksJson()))
                .internCandidateId(intern != null ? intern.getId() : null)
                .internName(internUser != null ? internUser.getFullName() : null)
                .engagementId(p.getEngagement() != null ? p.getEngagement().getId() : null)
                .assignedById(assignedBy != null ? assignedBy.getId() : null)
                .assignedByName(assignedBy != null ? assignedBy.getFullName() : null)
                .startDate(p.getStartDate())
                .dueDate(p.getDueDate())
                .status(p.getStatus())
                .progressPct(p.getProgressPct())
                .reviewNotes(p.getReviewNotes())
                .reviewedById(reviewedBy != null ? reviewedBy.getId() : null)
                .reviewedByName(reviewedBy != null ? reviewedBy.getFullName() : null)
                .reviewedAt(p.getReviewedAt())
                .createdAt(p.getCreatedAt())
                .startedAt(p.getStartedAt())
                .submittedAt(p.getSubmittedAt())
                .completedAt(p.getCompletedAt())
                .updatedAt(p.getUpdatedAt())
                .tasks(tasks.stream().map(this::toTaskResponse).toList())
                .submissions(submissions.stream().map(this::toSubmissionResponse).toList())
                .build();
    }

    private ProjectTaskResponse toTaskResponse(ProjectTask t) {
        return ProjectTaskResponse.builder()
                .id(t.getId())
                .title(t.getTitle())
                .done(t.getDone())
                .sortOrder(t.getSortOrder())
                .build();
    }

    private ProjectSubmissionResponse toSubmissionResponse(ProjectSubmission s) {
        return ProjectSubmissionResponse.builder()
                .id(s.getId())
                .description(s.getDescription())
                .links(deserializeList(s.getLinksJson()))
                .submittedAt(s.getSubmittedAt())
                .build();
    }
}
