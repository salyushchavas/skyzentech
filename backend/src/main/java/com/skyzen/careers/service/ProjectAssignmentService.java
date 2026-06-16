package com.skyzen.careers.service;

import com.skyzen.careers.dto.project.catalog.AssignProjectRequest;
import com.skyzen.careers.dto.project.catalog.AssignProjectResultResponse;
import com.skyzen.careers.dto.project.catalog.EligibleInternResponse;
import com.skyzen.careers.dto.project.catalog.ProjectAssignmentResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.ProjectAssignment;
import com.skyzen.careers.entity.ProjectSubmission;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.ProjectAssignmentStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.event.ProjectSubmittedEvent;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.github.GitHubIntegrationException;
import com.skyzen.careers.github.GitHubService;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.ProjectAssignmentRepository;
import com.skyzen.careers.repository.ProjectRepository;
import com.skyzen.careers.repository.ProjectSubmissionRepository;
import com.skyzen.careers.repository.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
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
    private final LifecycleAccessPolicy lifecycleAccessPolicy;
    private final ProjectSubmissionRepository projectSubmissionRepository;
    private final InternLifecycleRepository internLifecycleRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

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
                // Phase 8: don't assign new projects to an exited intern.
                if (!lifecycleAccessPolicy.canWrite(actor, internId,
                        LifecycleAccessPolicy.WriteIntent.CREATE_NEW)) {
                    failures.add(new AssignProjectResultResponse.Failure(
                            internId, "Internship is inactive"));
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

    /**
     * Intern submits (or re-submits) work for an assignment. Accepts
     * deliverable links + free-text notes; creates a {@link ProjectSubmission}
     * history row so the trainer's Pending Reviews queue (which reads
     * from {@code project_submissions}) picks it up, stamps the
     * assignment row, and publishes a {@link ProjectSubmittedEvent} so
     * the trainer is notified after commit.
     *
     * <p>Re-submission is allowed when the assignment is back in
     * {@code IN_PROGRESS} (returned-for-revisions) OR when the prior
     * submission carries {@code trainer_decision=REQUEST_REVISION}. The
     * version on the new {@code ProjectSubmission} row is the prior max
     * plus one — matches the trainer-review service's expectations.</p>
     */
    @Transactional
    public ProjectAssignmentResponse submitAssignment(
            UUID assignmentId, String submissionNotes,
            List<String> deliverableLinks, User actor) {
        ProjectAssignment a = loadAssignment(assignmentId);
        ensureOwningIntern(a, actor);

        List<String> validatedLinks = validateLinks(deliverableLinks);
        String trimmedNotes = submissionNotes != null && !submissionNotes.isBlank()
                ? submissionNotes.trim() : null;
        if (validatedLinks.isEmpty() && trimmedNotes == null) {
            throw new BadRequestException(
                    "Submission requires at least one deliverable link or notes.");
        }

        // Re-submission gate: allow when (a) intern is still IN_PROGRESS
        // (first submit, or trainer/RM returned-for-revisions via the
        // assignment endpoint), (b) status is SUBMITTED but the latest
        // ProjectSubmission carries REQUEST_REVISION (trainer review
        // pipe). Anything else (COMPLETED, TECH_APPROVED, etc.) is
        // locked.
        List<ProjectSubmission> history = projectSubmissionRepository
                .findByProjectIdOrderBySubmittedAtDesc(a.getProjectId());
        ProjectSubmission previousLatest = history.isEmpty() ? null : history.get(0);
        boolean revisionRequested = previousLatest != null
                && "REQUEST_REVISION".equalsIgnoreCase(previousLatest.getTrainerDecision());
        if (a.getStatus() == ProjectAssignmentStatus.IN_PROGRESS) {
            // first submit or resubmit after assignment-level return
        } else if (a.getStatus() == ProjectAssignmentStatus.SUBMITTED && revisionRequested) {
            // resubmit after trainer requested revisions on the submission row
        } else if (a.getStatus() == ProjectAssignmentStatus.ASSIGNED) {
            throw new BadRequestException(
                    "Start the project first — submission only allowed after the intern accepts the assignment.");
        } else if (a.getStatus() == ProjectAssignmentStatus.SUBMITTED) {
            throw new BadRequestException(
                    "Project is already submitted and awaiting trainer review.");
        } else {
            throw new BadRequestException(
                    "Cannot submit in status " + a.getStatus() + ".");
        }

        java.time.Instant now = java.time.Instant.now();
        Project project = projectRepository.findById(a.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + a.getProjectId()));
        int nextVersion = history.stream()
                .mapToInt(s -> s.getVersion() != null ? s.getVersion() : 1)
                .max().orElse(0) + 1;
        ProjectSubmission sub = ProjectSubmission.builder()
                .project(project)
                .description(trimmedNotes)
                .linksJson(serializeLinks(validatedLinks))
                .submittedAt(now)
                .version(nextVersion)
                .build();
        sub = projectSubmissionRepository.save(sub);

        a.setStatus(ProjectAssignmentStatus.SUBMITTED);
        a.setSubmittedAt(now);
        if (trimmedNotes != null) a.setSubmissionNotes(trimmedNotes);
        projectAssignmentRepository.save(a);

        UUID trainerUserId = resolveTrainerUserId(project, a);
        try {
            eventPublisher.publishEvent(new ProjectSubmittedEvent(
                    a.getId(), project.getId(), sub.getId(),
                    actor.getId(), trainerUserId,
                    project.getName() != null ? project.getName() : project.getTitle(),
                    nextVersion));
        } catch (Exception e) {
            log.warn("[ProjectAssignmentService] project-submitted event publish failed (non-fatal): {}",
                    e.getMessage());
        }
        log.info("[ProjectAssignmentService] assignment={} intern={} submitted v{} (links={}, hasNotes={})",
                assignmentId, actor.getId(), nextVersion,
                validatedLinks.size(), trimmedNotes != null);
        return mapWithGraph(List.of(a)).get(0);
    }

    /**
     * Validate each non-blank link parses as an absolute URL. Returns a
     * cleaned, de-duplicated list preserving input order. Empty / null
     * input → empty list (not an error — notes-only submissions are
     * allowed downstream).
     */
    private List<String> validateLinks(List<String> raw) {
        if (raw == null || raw.isEmpty()) return List.of();
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        for (String link : raw) {
            if (link == null) continue;
            String trimmed = link.trim();
            if (trimmed.isEmpty()) continue;
            try {
                java.net.URI uri = new java.net.URI(trimmed);
                if (!uri.isAbsolute()
                        || uri.getScheme() == null
                        || uri.getHost() == null
                        || !(uri.getScheme().equalsIgnoreCase("http")
                            || uri.getScheme().equalsIgnoreCase("https"))) {
                    throw new BadRequestException(
                            "Deliverable link must be an absolute http/https URL: '"
                                    + trimmed + "'");
                }
            } catch (java.net.URISyntaxException e) {
                throw new BadRequestException(
                        "Deliverable link is not a valid URL: '" + trimmed + "'");
            }
            out.add(trimmed);
        }
        return new ArrayList<>(out);
    }

    private String serializeLinks(List<String> links) {
        if (links == null || links.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(links);
        } catch (Exception e) {
            log.warn("[ProjectAssignmentService] serializeLinks failed (non-fatal): {}",
                    e.getMessage());
            return null;
        }
    }

    private List<String> deserializeLinks(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (Exception e) {
            log.debug("deserializeLinks failed (non-fatal): {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Resolve which Trainer to notify on submission. Preferred path:
     * Project.internLifecycleId → InternLifecycle.trainerId. Falls back
     * to ProjectAssignment.assignedById (the TE who created the
     * assignment) when the lifecycle linkage isn't populated.
     */
    private UUID resolveTrainerUserId(Project project, ProjectAssignment a) {
        try {
            if (project.getInternLifecycleId() != null) {
                UUID t = internLifecycleRepository.findById(project.getInternLifecycleId())
                        .map(il -> il.getTrainerId())
                        .orElse(null);
                if (t != null) return t;
            }
        } catch (Exception e) {
            log.debug("trainer lookup via lifecycle failed (non-fatal): {}", e.getMessage());
        }
        return a.getAssignedById();
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
        // Bulk-fetch latest ProjectSubmission per project so the intern
        // surface can render what they sent + any trainer feedback
        // without N+1 round-trips.
        Map<UUID, ProjectSubmission> latestSubByProject = new HashMap<>();
        for (UUID pid : projectIds) {
            List<ProjectSubmission> hist = projectSubmissionRepository
                    .findByProjectIdOrderBySubmittedAtDesc(pid);
            if (!hist.isEmpty()) {
                ProjectSubmission top = hist.get(0);
                latestSubByProject.put(pid, top);
                if (top.getReviewedById() != null) userIds.add(top.getReviewedById());
            }
        }
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
            ProjectSubmission top = p != null ? latestSubByProject.get(p.getId()) : null;
            ProjectAssignmentResponse.LatestSubmission latest = top == null ? null
                    : new ProjectAssignmentResponse.LatestSubmission(
                            top.getId(),
                            top.getVersion(),
                            deserializeLinks(top.getLinksJson()),
                            top.getDescription(),
                            top.getSubmittedAt(),
                            top.getTrainerDecision(),
                            top.getTrainerFeedback(),
                            top.getReviewedAt(),
                            top.getReviewedById() != null
                                    && users.get(top.getReviewedById()) != null
                                    ? users.get(top.getReviewedById()).getFullName()
                                    : null);
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
                    latest,
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
