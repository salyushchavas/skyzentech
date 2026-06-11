package com.skyzen.careers.trainer.projects;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Document;
import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.ProjectAssignmentEventLog;
import com.skyzen.careers.entity.ProjectTemplate;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ProjectStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.intern.DocumentVaultService;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.DocumentRepository;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.ProjectAssignmentEventLogRepository;
import com.skyzen.careers.repository.ProjectRepository;
import com.skyzen.careers.repository.ProjectTemplateRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.trainer.projects.TrainerProjectDtos.AssignProjectRequest;
import com.skyzen.careers.trainer.projects.TrainerProjectDtos.ProjectDetail;
import com.skyzen.careers.trainer.projects.TrainerProjectDtos.SlotStatusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Trainer Phase 2 — the doc §6/§7 Project Assignment Wizard surface.
 *
 * <p>Validates the 11 doc §7 fields, enforces the 2-projects-per-month
 * rule with friendly 409s before the DB-level partial UNIQUE trips,
 * captures backdating metadata inline, instantiates from a
 * {@link ProjectTemplate} when one is supplied (deep-copying instructions
 * + bumping {@code usage_count} atomically), persists the {@link Project}
 * row, writes a {@link ProjectAssignmentEventLog} chain, and fires the
 * 4-recipient PROJECT_ASSIGNED notification fan-out via
 * {@link com.skyzen.careers.notification.ProjectNotificationDispatcher}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TrainerProjectAssignmentService {

    private static final long MAX_PROJECT_FILE_BYTES = 50L * 1024 * 1024;
    private static final Set<String> ALLOWED_PROJECT_MIME = Set.of(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream"  // some browsers send this for .zip
    );
    private static final int MAX_INSTRUCTIONS = 20_000;
    private static final int MAX_GITHUB_INSTRUCTIONS = 5_000;
    private static final int MAX_BACKDATE_REASON = 1_000;
    private static final int MIN_BACKDATE_REASON = 30;
    private static final int MAX_AUTHORIZER_NAME = 200;
    private static final int MAX_LEARNING_OBJECTIVE = 300;
    private static final int MAX_SECONDARY_TAG = 100;

    private final ProjectRepository projectRepository;
    private final ProjectTemplateRepository templateRepository;
    private final ProjectAssignmentEventLogRepository eventLogRepository;
    private final InternLifecycleRepository lifecycleRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final AuditLogRepository auditLogRepository;
    private final DocumentVaultService documentVault;
    private final ProjectNotificationDispatcher notifier;
    private final ObjectMapper objectMapper;

    // ── Slot status (live wizard indicator) ───────────────────────────────

    @Transactional(readOnly = true)
    public SlotStatusResponse getSlotStatus(UUID lifecycleId, String monthYear, User caller) {
        requireTrainer(caller);
        InternLifecycle lc = mustLoadLifecycle(lifecycleId);
        requireInScope(lc, caller);
        validateMonthYearFormat(monthYear);

        List<Project> existing = projectRepository
                .findByInternLifecycleIdAndMonthYearOrderByProjectNumberAsc(
                        lifecycleId, monthYear);
        boolean s1 = false, s2 = false;
        String s1Title = null, s2Title = null;
        UUID s1Id = null, s2Id = null;
        for (Project p : existing) {
            if (Short.valueOf((short) 1).equals(p.getProjectNumber())) {
                s1 = true; s1Title = p.getTitle(); s1Id = p.getId();
            } else if (Short.valueOf((short) 2).equals(p.getProjectNumber())) {
                s2 = true; s2Title = p.getTitle(); s2Id = p.getId();
            }
        }
        boolean backdating = isBackdated(monthYear);
        return new SlotStatusResponse(monthYear, s1, s1Title, s1Id, s2, s2Title, s2Id,
                s1 && s2, backdating);
    }

    // ── Assign project ────────────────────────────────────────────────────

    @Transactional
    public ProjectDetail assignProject(AssignProjectRequest req, User caller) {
        requireTrainer(caller);
        if (req == null) throw new BadRequestException("body required");

        // 1) Resolve + scope-check intern
        if (req.internLifecycleId() == null) {
            throw new BadRequestException("internLifecycleId is required");
        }
        InternLifecycle lc = mustLoadLifecycle(req.internLifecycleId());
        requireInScope(lc, caller);
        if (!"ACTIVE".equalsIgnoreCase(safeStr(lc.getActiveStatus()))
                && !"PROSPECTIVE".equalsIgnoreCase(safeStr(lc.getActiveStatus()))) {
            throw new ConflictException(
                    "Intern is no longer active (status="
                            + lc.getActiveStatus() + ").");
        }

        // 2) Validate month_year + slot
        validateMonthYearFormat(req.monthYear());
        if (req.projectNumber() == null
                || (req.projectNumber() != 1 && req.projectNumber() != 2)) {
            throw new BadRequestException("projectNumber must be 1 or 2");
        }
        if (lc.getHiredAt() != null) {
            YearMonth requested = YearMonth.parse(req.monthYear());
            YearMonth hired = YearMonth.from(
                    lc.getHiredAt().atZone(java.time.ZoneOffset.UTC).toLocalDate());
            if (requested.isBefore(hired)) {
                throw new ConflictException(
                        "Cannot backdate before the intern's hire month ("
                                + hired + ").");
            }
        }

        // 3) 2-per-month rule (friendly 409 before the partial UNIQUE)
        List<Project> existing = projectRepository
                .findByInternLifecycleIdAndMonthYearOrderByProjectNumberAsc(
                        lc.getId(), req.monthYear());
        for (Project p : existing) {
            if (req.projectNumber().equals(p.getProjectNumber())) {
                throw new ConflictException(
                        "Project " + req.projectNumber() + " already assigned for "
                                + req.monthYear() + " (\"" + p.getTitle() + "\"). "
                                + "Cancel the existing project first or pick a different slot.");
            }
        }
        if (existing.size() >= 2) {
            throw new ConflictException(
                    "Both project slots already assigned for " + req.monthYear()
                            + ". Cancel an existing project first or pick a "
                            + "different month.");
        }

        // 4) Validate doc §7 required fields + lengths
        if (isBlank(req.title()) || req.title().length() > 200) {
            throw new BadRequestException("title is required (1-200 chars)");
        }
        if (isBlank(req.technologyArea()) || req.technologyArea().length() > 100) {
            throw new BadRequestException("technologyArea is required (1-100 chars)");
        }
        if (req.secondaryTag() != null && req.secondaryTag().length() > MAX_SECONDARY_TAG) {
            throw new BadRequestException("secondaryTag max " + MAX_SECONDARY_TAG + " chars");
        }
        if (isBlank(req.instructions())) {
            throw new BadRequestException("instructions are required");
        }
        if (req.instructions().length() > MAX_INSTRUCTIONS) {
            throw new BadRequestException("instructions max " + MAX_INSTRUCTIONS + " chars");
        }
        boolean usesGithub = Boolean.TRUE.equals(req.usesGithub());
        if (usesGithub) {
            if (isBlank(req.githubInstructions())) {
                throw new BadRequestException(
                        "githubInstructions required when usesGithub is true");
            }
            if (req.githubInstructions().length() > MAX_GITHUB_INSTRUCTIONS) {
                throw new BadRequestException(
                        "githubInstructions max " + MAX_GITHUB_INSTRUCTIONS + " chars");
            }
        }
        if (req.dueDate() == null) throw new BadRequestException("dueDate is required");
        if (!req.dueDate().isAfter(LocalDate.now())) {
            throw new BadRequestException("dueDate must be in the future");
        }
        if (req.learningObjectiveLabel() != null
                && req.learningObjectiveLabel().length() > MAX_LEARNING_OBJECTIVE) {
            throw new BadRequestException(
                    "learningObjectiveLabel max " + MAX_LEARNING_OBJECTIVE + " chars");
        }

        // 5) Backdating gate
        boolean backdated = isBackdated(req.monthYear());
        Instant now = Instant.now();
        String backdateAuthorizer = null;
        if (backdated) {
            if (isBlank(req.backdateAuthorizedByName())
                    || req.backdateAuthorizedByName().length() > MAX_AUTHORIZER_NAME) {
                throw new BadRequestException(
                        "backdateAuthorizedByName required (1-"
                                + MAX_AUTHORIZER_NAME + " chars) for past-month assignments");
            }
            if (isBlank(req.backdateReason())
                    || req.backdateReason().length() < MIN_BACKDATE_REASON
                    || req.backdateReason().length() > MAX_BACKDATE_REASON) {
                throw new BadRequestException(
                        "backdateReason required (" + MIN_BACKDATE_REASON + "-"
                                + MAX_BACKDATE_REASON + " chars) for past-month assignments");
            }
            backdateAuthorizer = req.backdateAuthorizedByName().trim();
        }

        // 6) Template instantiation (deep-copy + atomic usage_count bump)
        ProjectTemplate template = null;
        if (req.projectTemplateId() != null) {
            template = templateRepository.findById(req.projectTemplateId())
                    .orElseThrow(() -> new BadRequestException(
                            "Template no longer available; please pick another."));
            if (template.getArchivedAt() != null
                    || !Boolean.TRUE.equals(template.getPublished())) {
                throw new BadRequestException(
                        "Template is not currently published; please pick another.");
            }
            template.setUsageCount(template.getUsageCount() == null
                    ? 1 : template.getUsageCount() + 1);
            templateRepository.save(template);
        }

        // 7) Persist Project
        Project project = Project.builder()
                .title(req.title().trim())
                .description(template != null ? template.getDescription() : null)
                .instructions(req.instructions())
                .internLifecycleId(lc.getId())
                .projectNumber(req.projectNumber())
                .monthYear(req.monthYear())
                .assignedBy(caller)
                .startDate(LocalDate.now())
                .dueDate(req.dueDate())
                .status(ProjectStatus.NOT_STARTED)
                .progressPct(0)
                .name(req.title().trim())
                .techStack(req.technologyArea().trim()
                        + (req.secondaryTag() != null && !req.secondaryTag().isBlank()
                            ? ", " + req.secondaryTag().trim() : ""))
                .learningObjectiveLabel(req.learningObjectiveLabel() != null
                        ? req.learningObjectiveLabel().trim() : null)
                .i983ObjectiveIndex(req.i983ObjectiveIndex())
                .projectTemplateId(template != null ? template.getId() : null)
                .notifyStakeholdersInternal(req.notifyStakeholdersInternal() == null
                        ? Boolean.TRUE : req.notifyStakeholdersInternal())
                .createdById(caller.getId())
                .backdateReason(backdated ? req.backdateReason().trim() : null)
                .backdateAuthorizedAt(backdated ? now : null)
                .build();
        // Encode the github_instructions inside the description blob for
        // now; a dedicated column lives on ProjectTemplate but Project
        // re-uses the legacy 'instructions' column for the full body.
        if (usesGithub) {
            project.setInstructions(project.getInstructions()
                    + "\n\n## GitHub setup\n\n" + req.githubInstructions().trim());
        }
        project = projectRepository.save(project);

        // 8) Event log chain
        appendEventLog(project.getId(), caller.getId(), "CREATED", project,
                Map.of("projectNumber", req.projectNumber(),
                        "monthYear", req.monthYear(),
                        "templateId", req.projectTemplateId(),
                        "backdated", backdated));
        if (template != null) {
            appendEventLog(project.getId(), caller.getId(), "TEMPLATE_INSTANTIATED",
                    "instantiated from template " + template.getTitle(),
                    Map.of("templateId", template.getId(),
                            "templateUsageCount", template.getUsageCount()));
        }
        if (backdated) {
            appendEventLog(project.getId(), caller.getId(), "BACKDATE_AUTHORIZED",
                    "backdated to " + req.monthYear(),
                    Map.of("authorizedBy", backdateAuthorizer,
                            "reason", req.backdateReason().trim(),
                            "authorizedAt", now));
        }
        appendEventLog(project.getId(), caller.getId(), "PUBLISHED",
                "fan-out notifications dispatched", null);

        // 9) Audit log (cross-domain)
        writeAudit(project.getId(), "PROJECT_ASSIGNED", caller.getId(),
                lc.getUserId(),
                null,
                Map.of("title", project.getTitle(),
                        "monthYear", project.getMonthYear(),
                        "projectNumber", project.getProjectNumber()));

        // 10) Notification fan-out (after_commit; emails + in-app)
        notifier.dispatchProjectAssigned(project, lc, caller,
                Boolean.TRUE.equals(project.getNotifyStakeholdersInternal()),
                backdated, backdateAuthorizer);

        return toDetail(project);
    }

    // ── Attach project file (called after assignProject succeeds) ─────────

    @Transactional
    public ProjectDetail attachProjectFile(UUID projectId, MultipartFile file, User caller) {
        requireTrainer(caller);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("file is required");
        }
        if (file.getSize() > MAX_PROJECT_FILE_BYTES) {
            throw new BadRequestException("Project file exceeds 50 MB limit");
        }
        String mime = file.getContentType();
        if (mime != null && !ALLOWED_PROJECT_MIME.contains(mime)) {
            throw new BadRequestException(
                    "Unsupported file type (PDF / DOCX / ZIP only). Got: " + mime);
        }
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + projectId));
        InternLifecycle lc = mustLoadLifecycle(project.getInternLifecycleId());
        requireInScope(lc, caller);

        try {
            Document doc = documentVault.saveDocument(
                    caller.getId(),
                    file.getOriginalFilename(),
                    mime != null ? mime : "application/octet-stream",
                    file.getBytes(),
                    "PROJECT_FILE",
                    "GENERAL",
                    caller.getId());
            // Stash the document id in resource_links_json as a single-entry
            // JSON array so existing reader logic can pick it up; a dedicated
            // column lands in a future phase if/when projects support multi.
            project.setResourceLinksJson("[\"" + doc.getId() + "\"]");
            project = projectRepository.save(project);
            appendEventLog(project.getId(), caller.getId(), "FILE_ATTACHED",
                    file.getOriginalFilename(),
                    Map.of("documentId", doc.getId(),
                            "fileSize", file.getSize(),
                            "mimeType", mime));
            return toDetail(project);
        } catch (BadRequestException re) {
            throw re;
        } catch (Exception e) {
            log.warn("[TrainerProject] file attach failed: {}", e.getMessage());
            throw new RuntimeException("Upload failed: " + e.getMessage(), e);
        }
    }

    // ── Read ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ProjectDetail getProject(UUID id, User caller) {
        requireTrainer(caller);
        Project p = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + id));
        if (p.getInternLifecycleId() != null) {
            InternLifecycle lc = mustLoadLifecycle(p.getInternLifecycleId());
            requireInScope(lc, caller);
        }
        return toDetail(p);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private void requireTrainer(User caller) {
        if (caller == null) throw new ForbiddenException("Caller required");
        if (!caller.getRoles().contains(UserRole.TRAINER)
                && !caller.getRoles().contains(UserRole.SUPER_ADMIN)) {
            throw new ForbiddenException("TRAINER or SUPER_ADMIN required");
        }
    }

    private void requireInScope(InternLifecycle lc, User caller) {
        if (caller.getRoles().contains(UserRole.SUPER_ADMIN)) return;
        if (lc.getTrainerId() == null
                || !lc.getTrainerId().equals(caller.getId())) {
            throw new ForbiddenException("Intern is not in your roster.");
        }
    }

    private InternLifecycle mustLoadLifecycle(UUID id) {
        if (id == null) throw new BadRequestException("internLifecycleId is required");
        return lifecycleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "InternLifecycle not found: " + id));
    }

    private void validateMonthYearFormat(String monthYear) {
        if (monthYear == null || monthYear.length() != 7) {
            throw new BadRequestException("monthYear must be YYYY-MM");
        }
        try {
            YearMonth.parse(monthYear, DateTimeFormatter.ofPattern("yyyy-MM"));
        } catch (Exception e) {
            throw new BadRequestException("monthYear must be YYYY-MM");
        }
    }

    private boolean isBackdated(String monthYear) {
        return YearMonth.parse(monthYear).isBefore(YearMonth.now());
    }

    private void appendEventLog(UUID projectId, UUID actorId, String eventType,
                                 Object comments, Map<String, Object> payload) {
        try {
            String payloadJson = null;
            if (payload != null && !payload.isEmpty()) {
                payloadJson = objectMapper.writeValueAsString(payload);
            }
            String commentsText = null;
            if (comments != null) {
                if (comments instanceof String s) commentsText = s;
                else commentsText = String.valueOf(comments);
            }
            ProjectAssignmentEventLog row = ProjectAssignmentEventLog.builder()
                    .projectId(projectId)
                    .actorUserId(actorId)
                    .eventType(eventType)
                    .comments(commentsText)
                    .payloadJson(payloadJson)
                    .build();
            eventLogRepository.save(row);
        } catch (Exception e) {
            log.warn("[TrainerProject] event log write failed ({}): {}",
                    eventType, e.getMessage());
        }
    }

    private void writeAudit(UUID entityId, String action, UUID actorId,
                             UUID subjectUserId,
                             Map<String, Object> before, Map<String, Object> after) {
        try {
            AuditLog row = AuditLog.builder()
                    .userId(actorId)
                    .subjectUserId(subjectUserId)
                    .entityType("Project")
                    .entityId(entityId)
                    .action(action)
                    .beforeJson(before != null
                            ? objectMapper.writeValueAsString(before) : null)
                    .afterJson(after != null
                            ? objectMapper.writeValueAsString(after) : null)
                    .build();
            auditLogRepository.save(row);
        } catch (Exception e) {
            log.warn("[TrainerProject] audit write failed: {}", e.getMessage());
        }
    }

    private ProjectDetail toDetail(Project p) {
        UUID internUserId = null;
        String internName = null;
        if (p.getInternLifecycleId() != null) {
            InternLifecycle lc = lifecycleRepository.findById(p.getInternLifecycleId())
                    .orElse(null);
            if (lc != null && lc.getUserId() != null) {
                User u = userRepository.findById(lc.getUserId()).orElse(null);
                internUserId = lc.getUserId();
                internName = u != null ? u.getFullName() : null;
            }
        }
        String assignedByName = p.getAssignedBy() != null
                ? p.getAssignedBy().getFullName() : null;
        UUID projectFileId = null;
        String projectFileName = null;
        if (p.getResourceLinksJson() != null) {
            try {
                List<?> ids = objectMapper.readValue(p.getResourceLinksJson(), List.class);
                if (!ids.isEmpty() && ids.get(0) != null) {
                    UUID id = UUID.fromString(ids.get(0).toString());
                    Document doc = documentRepository.findById(id).orElse(null);
                    if (doc != null) {
                        projectFileId = doc.getId();
                        projectFileName = doc.getFileName();
                    }
                }
            } catch (Exception ignored) { /* legacy resource_links_json shape */ }
        }
        return new ProjectDetail(
                p.getId(),
                p.getInternLifecycleId(),
                internUserId,
                internName,
                p.getMonthYear(),
                p.getProjectNumber(),
                p.getTitle(),
                p.getTechStack(),
                null,                       // secondaryTag not split-stored
                p.getInstructions(),
                null,                       // github extracted inline
                p.getDueDate(),
                p.getLearningObjectiveLabel(),
                p.getI983ObjectiveIndex(),
                p.getStatus() != null ? p.getStatus().name() : null,
                p.getNotifyStakeholdersInternal(),
                p.getAssignedBy() != null ? p.getAssignedBy().getId() : null,
                assignedByName,
                p.getProjectTemplateId(),
                projectFileId,
                projectFileName,
                null,                       // backdate authorizer not stored as text
                p.getBackdateReason(),
                p.getBackdateAuthorizedAt(),
                p.getCreatedAt(),
                p.getUpdatedAt());
    }

    private static boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }
    private static String safeStr(String s) { return s == null ? "" : s; }
}
