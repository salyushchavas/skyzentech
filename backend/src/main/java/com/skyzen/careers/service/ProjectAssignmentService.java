package com.skyzen.careers.service;

import com.skyzen.careers.dto.project.catalog.AssignProjectRequest;
import com.skyzen.careers.dto.project.catalog.AssignProjectResultResponse;
import com.skyzen.careers.dto.project.catalog.EligibleInternResponse;
import com.skyzen.careers.dto.project.catalog.ProjectAssignmentResponse;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.ProjectAssignment;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.ProjectAssignmentStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.ProjectAssignmentRepository;
import com.skyzen.careers.repository.ProjectRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Assignment half of the Project Catalog + Assignment module. Validates
 * eligibility (intern role + active engagement) per intern, then inserts
 * one {@link ProjectAssignment} row per successful intern. Partial
 * success is the norm — failures are returned in the response rather
 * than aborting the whole batch.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProjectAssignmentService {

    private static final List<EngagementStatus> ELIGIBLE_STATUSES = List.of(
            EngagementStatus.READY_TO_START,
            EngagementStatus.ACTIVE);

    private final ProjectAssignmentRepository projectAssignmentRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final EngagementRepository engagementRepository;
    private final com.skyzen.careers.repository.ProjectRepositoryLinkRepository
            repositoryLinkRepository;

    @Transactional
    public AssignProjectResultResponse assignToInterns(
            AssignProjectRequest req, User actor) {
        Project project = projectRepository.findById(req.projectId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + req.projectId()));
        // Repository must be linked before the TE can assign — interns
        // need a place to push code on day one.
        if (!repositoryLinkRepository.existsByProjectId(project.getId())) {
            throw new BadRequestException(
                    "Project must have a repository linked before assigning.");
        }
        if (req.assignmentDate() == null) {
            throw new BadRequestException("assignmentDate is required");
        }
        if (req.dueDate() != null && req.dueDate().isBefore(req.assignmentDate())) {
            throw new BadRequestException(
                    "dueDate must be on or after assignmentDate");
        }
        if (req.internIds() == null || req.internIds().isEmpty()) {
            throw new BadRequestException("internIds must contain at least one user id");
        }

        // Pre-resolve every candidate's engagement so we can decide
        // eligibility per intern without N+1 lookups.
        Map<UUID, Boolean> eligibility = computeEligibility(req.internIds());

        List<AssignProjectResultResponse.Created> created = new ArrayList<>();
        List<AssignProjectResultResponse.Failure> failures = new ArrayList<>();

        for (UUID internId : req.internIds()) {
            try {
                Boolean eligible = eligibility.get(internId);
                if (eligible == null) {
                    failures.add(new AssignProjectResultResponse.Failure(
                            internId, "User not found"));
                    continue;
                }
                if (!eligible) {
                    failures.add(new AssignProjectResultResponse.Failure(
                            internId,
                            "User is not a hired intern (no active engagement)"));
                    continue;
                }
                ProjectAssignment a = ProjectAssignment.builder()
                        .projectId(project.getId())
                        .internId(internId)
                        .assignedById(actor.getId())
                        .assignmentDate(req.assignmentDate())
                        .dueDate(req.dueDate())
                        .remarks(req.remarks())
                        .status(ProjectAssignmentStatus.ASSIGNED)
                        .accessGranted(Boolean.FALSE)
                        .build();
                a = projectAssignmentRepository.save(a);
                created.add(new AssignProjectResultResponse.Created(
                        a.getId(), internId, "CREATED"));
                log.info("[ProjectAssignmentService] assigned project={} intern={} by={} id={}",
                        project.getId(), internId, actor.getId(), a.getId());
            } catch (Exception e) {
                failures.add(new AssignProjectResultResponse.Failure(
                        internId, e.getMessage()));
                log.warn("[ProjectAssignmentService] assign failed project={} intern={}: {}",
                        project.getId(), internId, e.getMessage());
            }
        }
        return new AssignProjectResultResponse(created, failures);
    }

    // ── Out-of-band access tracking + lifecycle transitions ────────────────

    @Transactional
    public ProjectAssignmentResponse markAccessGranted(UUID assignmentId, User actor) {
        ensureStaff(actor);
        ProjectAssignment a = loadAssignment(assignmentId);
        if (Boolean.TRUE.equals(a.getAccessGranted())) {
            return mapWithGraph(List.of(a)).get(0);
        }
        a.setAccessGranted(Boolean.TRUE);
        a.setAccessGrantedAt(java.time.Instant.now());
        a.setAccessGrantedById(actor.getId());
        projectAssignmentRepository.save(a);
        log.info("[ProjectAssignmentService] access granted assignment={} by={}",
                assignmentId, actor.getId());
        return mapWithGraph(List.of(a)).get(0);
    }

    @Transactional
    public ProjectAssignmentResponse revokeAccessGranted(UUID assignmentId, User actor) {
        ensureStaff(actor);
        ProjectAssignment a = loadAssignment(assignmentId);
        a.setAccessGranted(Boolean.FALSE);
        a.setAccessGrantedAt(null);
        a.setAccessGrantedById(null);
        projectAssignmentRepository.save(a);
        log.info("[ProjectAssignmentService] access revoked assignment={} by={}",
                assignmentId, actor.getId());
        return mapWithGraph(List.of(a)).get(0);
    }

    @Transactional
    public ProjectAssignmentResponse startAssignment(UUID assignmentId, User actor) {
        ProjectAssignment a = loadAssignment(assignmentId);
        ensureOwningIntern(a, actor);
        if (a.getStatus() != ProjectAssignmentStatus.ASSIGNED) {
            throw new BadRequestException(
                    "Cannot start assignment in status " + a.getStatus());
        }
        User self = userRepository.findById(actor.getId()).orElse(actor);
        if (self.getGithubUsername() == null || self.getGithubUsername().isBlank()) {
            throw new BadRequestException(
                    "Please provide your GitHub username first.");
        }
        if (!Boolean.TRUE.equals(a.getAccessGranted())) {
            throw new BadRequestException(
                    "Repository access has not been granted yet. "
                            + "The Technical Evaluator will invite you on GitHub.");
        }
        a.setStatus(ProjectAssignmentStatus.IN_PROGRESS);
        a.setStartedAt(java.time.Instant.now());
        projectAssignmentRepository.save(a);
        log.info("[ProjectAssignmentService] assignment={} intern={} started",
                assignmentId, actor.getId());
        return mapWithGraph(List.of(a)).get(0);
    }

    @Transactional
    public ProjectAssignmentResponse submitAssignment(
            UUID assignmentId, String submissionNotes, User actor) {
        ProjectAssignment a = loadAssignment(assignmentId);
        ensureOwningIntern(a, actor);
        if (a.getStatus() == ProjectAssignmentStatus.SUBMITTED) {
            throw new BadRequestException("Project is already submitted.");
        }
        if (a.getStatus() != ProjectAssignmentStatus.IN_PROGRESS) {
            throw new BadRequestException("Project has not been started.");
        }
        a.setStatus(ProjectAssignmentStatus.SUBMITTED);
        a.setSubmittedAt(java.time.Instant.now());
        if (submissionNotes != null && !submissionNotes.isBlank()) {
            a.setSubmissionNotes(submissionNotes.trim());
        }
        projectAssignmentRepository.save(a);
        log.info("[ProjectAssignmentService] assignment={} intern={} submitted",
                assignmentId, actor.getId());
        return mapWithGraph(List.of(a)).get(0);
    }

    private ProjectAssignment loadAssignment(UUID id) {
        return projectAssignmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Assignment not found: " + id));
    }

    private static void ensureStaff(User actor) {
        if (actor == null) throw new ForbiddenException("Authentication required");
        if (actor.getRoles() == null
                || (!actor.getRoles().contains(UserRole.TECHNICAL_SUPERVISOR)
                    && !actor.getRoles().contains(UserRole.SUPER_ADMIN))) {
            throw new ForbiddenException(
                    "Only TECHNICAL_SUPERVISOR or SUPER_ADMIN may perform this action.");
        }
    }

    private static void ensureOwningIntern(ProjectAssignment a, User actor) {
        if (actor == null) throw new ForbiddenException("Authentication required");
        if (!a.getInternId().equals(actor.getId())) {
            throw new ForbiddenException(
                    "Only the assigned intern may perform this action.");
        }
    }

    @Transactional(readOnly = true)
    public List<ProjectAssignmentResponse> listForIntern(UUID internId) {
        List<ProjectAssignment> rows = projectAssignmentRepository
                .findByInternIdOrderByAssignmentDateDescCreatedAtDesc(internId);
        return mapWithGraph(rows);
    }

    @Transactional(readOnly = true)
    public List<ProjectAssignmentResponse> listForProject(UUID projectId) {
        List<ProjectAssignment> rows = projectAssignmentRepository
                .findByProjectIdOrderByAssignmentDateDescCreatedAtDesc(projectId);
        return mapWithGraph(rows);
    }

    @Transactional(readOnly = true)
    public ProjectAssignmentResponse getAssignment(UUID id, User caller) {
        ProjectAssignment a = projectAssignmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Assignment not found: " + id));
        if (caller == null) throw new ForbiddenException("Authentication required");
        boolean isOwner = a.getInternId().equals(caller.getId());
        boolean staffAccess = caller.getRoles() != null
                && (caller.getRoles().contains(UserRole.TECHNICAL_SUPERVISOR)
                    || caller.getRoles().contains(UserRole.SUPER_ADMIN));
        if (!isOwner && !staffAccess) {
            throw new ForbiddenException("Not authorised to view this assignment");
        }
        return mapWithGraph(List.of(a)).get(0);
    }

    @Transactional(readOnly = true)
    public List<EligibleInternResponse> eligibleInterns() {
        // Engagement-driven roster (post Phase-3 step-10: ApplicationStatus
        // HIRED is deprecated; Engagement.status is the source of truth).
        List<Engagement> active = engagementRepository.findActiveRoster(ELIGIBLE_STATUSES);
        List<EligibleInternResponse> out = new ArrayList<>(active.size());
        Set<UUID> seen = new java.util.HashSet<>();
        for (Engagement e : active) {
            Candidate c = e.getCandidate();
            User u = c != null ? c.getUser() : null;
            if (u == null || !seen.add(u.getId())) continue;
            if (u.getRoles() == null
                    || !u.getRoles().contains(UserRole.INTERN)) continue;
            out.add(new EligibleInternResponse(
                    u.getId(),
                    u.getFullName(),
                    u.getEmail(),
                    u.getGithubUsername(),
                    e.getActualStartDate() != null ? e.getActualStartDate()
                            : e.getPlannedStartDate()));
        }
        out.sort(Comparator.comparing(
                EligibleInternResponse::fullName,
                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
        return out;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private Map<UUID, Boolean> computeEligibility(List<UUID> internIds) {
        Set<UUID> eligibleSet = eligibleInterns().stream()
                .map(EligibleInternResponse::id)
                .collect(Collectors.toSet());
        Set<UUID> existingUsers = userRepository.findAllById(internIds).stream()
                .map(User::getId)
                .collect(Collectors.toSet());
        Map<UUID, Boolean> out = new HashMap<>();
        for (UUID id : internIds) {
            if (!existingUsers.contains(id)) {
                out.put(id, null); // missing user
            } else {
                out.put(id, eligibleSet.contains(id));
            }
        }
        return out;
    }

    private List<ProjectAssignmentResponse> mapWithGraph(List<ProjectAssignment> rows) {
        if (rows.isEmpty()) return List.of();
        Set<UUID> projectIds = rows.stream().map(ProjectAssignment::getProjectId)
                .collect(Collectors.toSet());
        Set<UUID> userIds = new java.util.HashSet<>();
        for (ProjectAssignment r : rows) {
            userIds.add(r.getInternId());
            userIds.add(r.getAssignedById());
            if (r.getAccessGrantedById() != null) userIds.add(r.getAccessGrantedById());
        }
        Map<UUID, Project> projects = projectRepository.findAllById(projectIds).stream()
                .collect(Collectors.toMap(Project::getId, p -> p));
        Map<UUID, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        // Bulk-fetch repository links so per-row mapping doesn't N+1.
        Map<UUID, com.skyzen.careers.entity.ProjectRepositoryLink> repos = new HashMap<>();
        for (UUID pid : projectIds) {
            repositoryLinkRepository.findByProjectId(pid)
                    .ifPresent(l -> repos.put(pid, l));
        }

        return rows.stream().map(r -> {
            Project p = projects.get(r.getProjectId());
            User intern = users.get(r.getInternId());
            User assignedBy = users.get(r.getAssignedById());
            User accessGrantedBy = r.getAccessGrantedById() != null
                    ? users.get(r.getAccessGrantedById()) : null;
            com.skyzen.careers.entity.ProjectRepositoryLink link = p != null
                    ? repos.get(p.getId()) : null;
            ProjectAssignmentResponse.RepositorySummary repoSummary = link == null
                    ? null
                    : new ProjectAssignmentResponse.RepositorySummary(
                            link.getRepositoryName(), link.getRepositoryUrl());
            // Read remarks from new column, falling back to legacy `notes`
            // for rows persisted before the column was added.
            String remarks = r.getRemarks() != null && !r.getRemarks().isBlank()
                    ? r.getRemarks() : r.getNotes();
            return new ProjectAssignmentResponse(
                    r.getId(),
                    p == null ? null : new ProjectAssignmentResponse.ProjectRef(
                            p.getId(),
                            p.getName() != null ? p.getName() : p.getTitle(),
                            p.getTechStack(),
                            p.getDifficulty(),
                            p.getDescription(),
                            p.getRequirements(),
                            p.getObjectives(),
                            p.getDeliverables(),
                            p.getInstructions(),
                            p.getExpectedDurationDays(),
                            p.getStartDate(),
                            p.getDueDate(),
                            repoSummary),
                    userRef(intern),
                    userRef(assignedBy),
                    r.getAssignmentDate(),
                    r.getDueDate(),
                    remarks,
                    r.getStatus(),
                    r.getAccessGranted(),
                    r.getAccessGrantedAt(),
                    userRef(accessGrantedBy),
                    r.getStartedAt(),
                    r.getSubmittedAt(),
                    r.getSubmissionNotes(),
                    r.getCreatedAt(),
                    r.getUpdatedAt()
            );
        }).toList();
    }

    private static ProjectAssignmentResponse.UserRef userRef(User u) {
        if (u == null) return null;
        return new ProjectAssignmentResponse.UserRef(
                u.getId(), u.getFullName(), u.getEmail(), u.getGithubUsername());
    }

    @SuppressWarnings("unused")
    private static LocalDate todayLocal() { return LocalDate.now(); }
}
