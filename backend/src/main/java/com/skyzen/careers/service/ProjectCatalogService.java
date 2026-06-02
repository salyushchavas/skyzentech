package com.skyzen.careers.service;

import com.skyzen.careers.dto.project.catalog.CatalogProjectResponse;
import com.skyzen.careers.dto.project.catalog.CreateCatalogProjectRequest;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.ProjectAssignmentRepository;
import com.skyzen.careers.repository.ProjectRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Catalog half of the Project Assignment module. Creates and reads
 * catalog Project rows. Coexists with the legacy single-allocation
 * ProjectService — catalog projects leave {@code intern_id / status}
 * NULL; legacy projects continue to use those columns.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProjectCatalogService {

    private final ProjectRepository projectRepository;
    private final ProjectAssignmentRepository projectAssignmentRepository;
    private final UserRepository userRepository;
    private final com.skyzen.careers.repository.ProjectRepositoryLinkRepository
            repositoryLinkRepository;

    @Transactional
    public CatalogProjectResponse createCatalogProject(
            CreateCatalogProjectRequest req, User actor) {
        if (req.name() == null || req.name().isBlank()) {
            throw new BadRequestException("name is required");
        }
        if (req.endDate() != null && req.startDate() != null
                && req.endDate().isBefore(req.startDate())) {
            throw new BadRequestException("endDate must be on or after startDate");
        }

        Project project = new Project();
        project.setName(req.name().trim());
        project.setDescription(req.description());
        project.setRequirements(req.requirements());
        project.setObjectives(req.objectives());
        project.setTechStack(req.techStack());
        project.setExpectedDurationDays(req.expectedDurationDays());
        project.setDeliverables(req.deliverables());
        project.setDifficulty(req.difficulty());
        project.setInstructions(req.instructions());
        project.setStartDate(req.startDate());
        project.setCreatedById(actor.getId());
        // Catalog rows mirror the name into the legacy title column so legacy
        // readers (workspace, project board) still display something useful
        // until the columns are unified.
        project.setTitle(req.name().trim());
        project.setProgressPct(0);
        if (project.getCreatedAt() == null) {
            project.setCreatedAt(Instant.now());
        }
        project = projectRepository.save(project);

        log.info("[ProjectCatalogService] catalog project created id={} by user={}",
                project.getId(),
                actor.getId());
        return toResponse(project, actor);
    }

    @Transactional(readOnly = true)
    public CatalogProjectResponse getCatalogProject(UUID id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + id));
        User creator = resolveCreator(project.getCreatedById());
        return toResponseWithCount(project, creator);
    }

    @Transactional(readOnly = true)
    public List<CatalogProjectResponse> listCreatedBy(UUID userId) {
        List<Project> projects = projectRepository.findByCreatedByIdOrderByCreatedAtDesc(userId);
        return mapWithCounts(projects);
    }

    @Transactional(readOnly = true)
    public List<CatalogProjectResponse> listAllCatalog() {
        // Catalog projects are the ones with a created_by_id set; legacy
        // single-allocation rows leave it null. Sort newest first.
        List<Project> projects = projectRepository.findByCreatedByIdNotNullOrderByCreatedAtDesc();
        return mapWithCounts(projects);
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private List<CatalogProjectResponse> mapWithCounts(List<Project> projects) {
        if (projects.isEmpty()) return List.of();
        Set<UUID> creatorIds = projects.stream()
                .map(Project::getCreatedById)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, User> users = userRepository.findAllById(creatorIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        return projects.stream()
                .sorted(Comparator.comparing(
                        Project::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(p -> toResponseWithCount(p, users.get(p.getCreatedById())))
                .toList();
    }

    // ── Repository link / update ────────────────────────────────────────────

    @Transactional
    public CatalogProjectResponse linkRepository(
            UUID projectId, String repositoryName, String repositoryUrl, User actor) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + projectId));
        if (repositoryLinkRepository.existsByProjectId(projectId)) {
            throw new BadRequestException(
                    "Project already has a repository linked. Use PUT to update.");
        }
        com.skyzen.careers.entity.ProjectRepositoryLink link =
                com.skyzen.careers.entity.ProjectRepositoryLink.builder()
                .projectId(projectId)
                .repositoryName(trim(repositoryName))
                .repositoryUrl(normaliseUrl(repositoryUrl))
                .linkedById(actor.getId())
                .build();
        repositoryLinkRepository.save(link);
        log.info("[ProjectCatalogService] repository linked to project={} url={} by={}",
                projectId, link.getRepositoryUrl(), actor.getId());
        return toResponseWithCount(project, resolveCreator(project.getCreatedById()));
    }

    @Transactional
    public CatalogProjectResponse updateRepository(
            UUID projectId, String repositoryName, String repositoryUrl, User actor) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + projectId));
        com.skyzen.careers.entity.ProjectRepositoryLink link =
                repositoryLinkRepository.findByProjectId(projectId)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "No repository is linked to this project."));
        link.setRepositoryName(trim(repositoryName));
        link.setRepositoryUrl(normaliseUrl(repositoryUrl));
        link.setLinkedById(actor.getId());
        repositoryLinkRepository.save(link);
        log.info("[ProjectCatalogService] repository updated for project={} url={} by={}",
                projectId, link.getRepositoryUrl(), actor.getId());
        return toResponseWithCount(project, resolveCreator(project.getCreatedById()));
    }

    private static String trim(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String normaliseUrl(String url) {
        if (url == null) return null;
        String t = url.trim();
        if (t.endsWith("/")) t = t.substring(0, t.length() - 1);
        return t;
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private CatalogProjectResponse toResponse(Project p, User creator) {
        return new CatalogProjectResponse(
                p.getId(),
                p.getName() != null ? p.getName() : p.getTitle(),
                p.getDescription(),
                p.getRequirements(),
                p.getObjectives(),
                p.getTechStack(),
                p.getExpectedDurationDays(),
                p.getDeliverables(),
                p.getDifficulty(),
                p.getInstructions(),
                p.getStartDate(),
                p.getDueDate(),
                creator != null
                        ? new CatalogProjectResponse.UserRef(creator.getId(), creator.getFullName())
                        : null,
                0L,
                null,
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
    }

    private CatalogProjectResponse toResponseWithCount(Project p, User creator) {
        long count = projectAssignmentRepository.countByProjectId(p.getId());
        CatalogProjectResponse.RepositoryRef repoRef = repositoryLinkRepository
                .findByProjectId(p.getId())
                .map(link -> {
                    User linkedBy = resolveCreator(link.getLinkedById());
                    CatalogProjectResponse.UserRef linkedByRef = linkedBy == null
                            ? null
                            : new CatalogProjectResponse.UserRef(
                                    linkedBy.getId(), linkedBy.getFullName());
                    return new CatalogProjectResponse.RepositoryRef(
                            link.getId(),
                            link.getRepositoryName(),
                            link.getRepositoryUrl(),
                            linkedByRef,
                            link.getCreatedAt());
                })
                .orElse(null);
        CatalogProjectResponse base = toResponse(p, creator);
        return new CatalogProjectResponse(
                base.id(),
                base.name(),
                base.description(),
                base.requirements(),
                base.objectives(),
                base.techStack(),
                base.expectedDurationDays(),
                base.deliverables(),
                base.difficulty(),
                base.instructions(),
                base.startDate(),
                base.endDate(),
                base.createdBy(),
                count,
                repoRef,
                base.createdAt(),
                base.updatedAt()
        );
    }

    private User resolveCreator(UUID userId) {
        if (userId == null) return null;
        return userRepository.findById(userId).orElse(null);
    }
}
