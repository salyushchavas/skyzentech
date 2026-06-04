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
import com.skyzen.careers.github.GitHubIntegrationException;
import com.skyzen.careers.github.GitHubService;
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
    private final GitHubService gitHubService;

    /**
     * GitHub repo URL parsing — same shape as the legacy resource-link mirror
     * in ProjectService. Used to derive {@code owner / repo} from the link
     * row before calling the collaborator API.
     */
    private static final java.util.regex.Pattern GITHUB_REPO_URL =
            java.util.regex.Pattern.compile("^https?://github\\.com/([\\w.-]+)/([\\w.-]+?)(\\.git)?/?$");

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

        // When the GitHub App is configured we actually invite the user as a
        // repo collaborator. When it isn't, the flag flip remains a purely
        // platform-internal acknowledgement (the TE invited them on GitHub
        // manually) — same semantics as before. Both paths share the
        // precondition that we know which repo + which GitHub user.
        Long invitationId = null;
        if (gitHubService.isConfigured()) {
            // Resolve intern GitHub username from the user row.
            User internUser = userRepository.findById(a.getInternId())
                    .orElseThrow(() -> new BadRequestException(
                            "Intern user not found for this assignment."));
            String ghUsername = internUser.getGithubUsername();
            if (ghUsername == null || ghUsername.isBlank()) {
                throw new BadRequestException(
                        "Intern has not set a GitHub username yet. They must add it on "
                                + "their assignment page before access can be granted.");
            }

            // Resolve owner / repo from the project's linked repository.
            com.skyzen.careers.entity.ProjectRepositoryLink link = repositoryLinkRepository
                    .findByProjectId(a.getProjectId())
                    .orElseThrow(() -> new BadRequestException(
                            "No repository is linked to this project. Link one before granting access."));
            java.util.regex.Matcher m = GITHUB_REPO_URL.matcher(
                    link.getRepositoryUrl() == null ? "" : link.getRepositoryUrl().trim());
            if (!m.matches()) {
                throw new BadRequestException(
                        "Linked repository URL is not a GitHub repo URL — can't grant access automatically.");
            }
            String owner = m.group(1);
            String repo = m.group(2);

            GitHubService.AddCollaboratorResult result =
                    gitHubService.addCollaborator(owner, repo, ghUsername);
            invitationId = result.invitationId();
            log.info("[ProjectAssignmentService] GitHub collaborator-add op={} invitationId={} for assignment={}",
                    result.op(), invitationId, assignmentId);
        } else {
            log.info("[ProjectAssignmentService] GitHub App not configured — recording out-of-band grant "
                    + "for assignment={}", assignmentId);
        }

        a.setAccessGranted(Boolean.TRUE);
        a.setAccessGrantedAt(java.time.Instant.now());
        a.setAccessGrantedById(actor.getId());
        if (invitationId != null) {
            a.setGithubInvitationId(invitationId);
        }
        projectAssignmentRepository.save(a);
        log.info("[ProjectAssignmentService] access granted assignment={} by={} invitationId={}",
                assignmentId, actor.getId(), invitationId);
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

    // ── Reviewer lifecycle (TE + RM on ProjectAssignment) ──────────────────
    //
    // Mirrors the legacy ProjectWorkflowService state machine on the
    // assignment row. Status transitions:
    //   SUBMITTED      → TECH_APPROVED   (TECHNICAL_EVALUATOR)
    //   SUBMITTED      → IN_PROGRESS     (return for revisions; TE)
    //   TECH_APPROVED  → PENDING_VIVA    (REPORTING_MANAGER)
    //   TECH_APPROVED  → COMPLETED       (RM viva-skip close)
    //   TECH_APPROVED  → IN_PROGRESS     (RM return)
    //   PENDING_VIVA   → COMPLETED       (RM sign-off)
    //   PENDING_VIVA   → IN_PROGRESS     (RM return)
    // Each transition writes a structured info log; dedicated audit-row
    // unification with the legacy ProjectWorkflowService trail is deferred.

    @Transactional
    public ProjectAssignmentResponse techApprove(UUID assignmentId, User actor) {
        ensureStaff(actor);
        ProjectAssignment a = loadAssignment(assignmentId);
        if (a.getStatus() == ProjectAssignmentStatus.TECH_APPROVED) {
            return mapWithGraph(List.of(a)).get(0);
        }
        if (a.getStatus() != ProjectAssignmentStatus.SUBMITTED) {
            throw new BadRequestException(
                    "Tech approval requires a SUBMITTED assignment (current: "
                            + a.getStatus() + ")");
        }
        a.setStatus(ProjectAssignmentStatus.TECH_APPROVED);
        projectAssignmentRepository.save(a);
        log.info("[ProjectAssignmentService] tech-approved assignment={} by={}",
                assignmentId, actor.getId());
        return mapWithGraph(List.of(a)).get(0);
    }

    @Transactional
    public ProjectAssignmentResponse returnForRevisions(
            UUID assignmentId, String reason, User actor) {
        ensureReviewerForReturn(actor);
        ProjectAssignment a = loadAssignment(assignmentId);
        ProjectAssignmentStatus from = a.getStatus();
        if (from != ProjectAssignmentStatus.SUBMITTED
                && from != ProjectAssignmentStatus.TECH_APPROVED
                && from != ProjectAssignmentStatus.PENDING_VIVA) {
            throw new BadRequestException(
                    "Can't return an assignment in status " + from);
        }
        if (reason == null || reason.trim().length() < 10) {
            throw new BadRequestException(
                    "A reason of at least 10 characters is required.");
        }
        a.setStatus(ProjectAssignmentStatus.IN_PROGRESS);
        String prior = a.getSubmissionNotes();
        String stamp = "[Returned by " + (actor.getFullName() != null
                ? actor.getFullName() : actor.getEmail()) + "] " + reason.trim();
        a.setSubmissionNotes(prior == null || prior.isBlank()
                ? stamp
                : prior + "\n\n" + stamp);
        projectAssignmentRepository.save(a);
        log.info("[ProjectAssignmentService] returned assignment={} from={} by={}",
                assignmentId, from, actor.getId());
        return mapWithGraph(List.of(a)).get(0);
    }

    @Transactional
    public ProjectAssignmentResponse markPendingViva(UUID assignmentId, User actor) {
        ensureReportingManager(actor);
        ProjectAssignment a = loadAssignment(assignmentId);
        if (a.getStatus() == ProjectAssignmentStatus.PENDING_VIVA) {
            return mapWithGraph(List.of(a)).get(0);
        }
        if (a.getStatus() != ProjectAssignmentStatus.TECH_APPROVED) {
            throw new BadRequestException(
                    "Mark-pending-viva requires TECH_APPROVED (current: "
                            + a.getStatus() + ")");
        }
        a.setStatus(ProjectAssignmentStatus.PENDING_VIVA);
        projectAssignmentRepository.save(a);
        log.info("[ProjectAssignmentService] marked-pending-viva assignment={} by={}",
                assignmentId, actor.getId());
        return mapWithGraph(List.of(a)).get(0);
    }

    @Transactional
    public ProjectAssignmentResponse completeAfterViva(UUID assignmentId, User actor) {
        ensureReportingManager(actor);
        ProjectAssignment a = loadAssignment(assignmentId);
        if (a.getStatus() == ProjectAssignmentStatus.COMPLETED) {
            return mapWithGraph(List.of(a)).get(0);
        }
        if (a.getStatus() != ProjectAssignmentStatus.PENDING_VIVA
                && a.getStatus() != ProjectAssignmentStatus.TECH_APPROVED) {
            throw new BadRequestException(
                    "Complete-after-viva requires PENDING_VIVA or TECH_APPROVED (current: "
                            + a.getStatus() + ")");
        }
        a.setStatus(ProjectAssignmentStatus.COMPLETED);
        projectAssignmentRepository.save(a);
        log.info("[ProjectAssignmentService] completed-after-viva assignment={} by={}",
                assignmentId, actor.getId());
        return mapWithGraph(List.of(a)).get(0);
    }

    /**
     * Status-filtered list for the TE submitted queue + the RM viva queue.
     * Pure read; role check happens on the controller endpoints.
     */
    @Transactional(readOnly = true)
    public List<ProjectAssignmentResponse> listByStatuses(
            List<ProjectAssignmentStatus> statuses) {
        if (statuses == null || statuses.isEmpty()) return List.of();
        List<ProjectAssignment> rows = projectAssignmentRepository
                .findByStatusInOrderByUpdatedAtDesc(statuses);
        return mapWithGraph(rows);
    }

    private ProjectAssignment loadAssignment(UUID id) {
        return projectAssignmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Assignment not found: " + id));
    }

    private static void ensureStaff(User actor) {
        if (actor == null) throw new ForbiddenException("Authentication required");
        if (actor.getRoles() == null
                || (!actor.getRoles().contains(UserRole.TRAINER)
                    && !actor.getRoles().contains(UserRole.SUPER_ADMIN))) {
            throw new ForbiddenException(
                    "Only TECHNICAL_EVALUATOR or SUPER_ADMIN may perform this action.");
        }
    }

    private static void ensureReportingManager(User actor) {
        if (actor == null) throw new ForbiddenException("Authentication required");
        if (actor.getRoles() == null
                || (!actor.getRoles().contains(UserRole.REPORTING_MANAGER)
                    && !actor.getRoles().contains(UserRole.SUPER_ADMIN))) {
            throw new ForbiddenException(
                    "Only REPORTING_MANAGER or SUPER_ADMIN may perform this action.");
        }
    }

    private static void ensureReviewerForReturn(User actor) {
        if (actor == null) throw new ForbiddenException("Authentication required");
        if (actor.getRoles() == null
                || (!actor.getRoles().contains(UserRole.TRAINER)
                    && !actor.getRoles().contains(UserRole.REPORTING_MANAGER)
                    && !actor.getRoles().contains(UserRole.SUPER_ADMIN))) {
            throw new ForbiddenException(
                    "Only TECHNICAL_EVALUATOR / REPORTING_MANAGER / SUPER_ADMIN "
                            + "may return an assignment for revisions.");
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
                && (caller.getRoles().contains(UserRole.TRAINER)
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
