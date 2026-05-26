package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.material.CreateWeeklyMaterialRequest;
import com.skyzen.careers.dto.material.MaterialAcknowledgementResponse;
import com.skyzen.careers.dto.material.UpdateWeeklyMaterialRequest;
import com.skyzen.careers.dto.material.WeeklyMaterialResponse;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.MaterialAcknowledgement;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.entity.WeeklyMaterial;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.enums.WeeklyMaterialStatus;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.MaterialAcknowledgementRepository;
import com.skyzen.careers.repository.WeeklyMaterialRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * GAP_REPORT C1 — weekly training material publication + intern feed.
 *
 * Visibility predicate for the intern feed (`getVisibleForIntern`):
 *   - Caller has a Candidate row, AND
 *   - That candidate has an Engagement with status == ACTIVE, AND
 *   - The material has status RELEASED, AND
 *   - The material is either broadcast (engagement_id IS NULL) OR scoped
 *     to the candidate's active engagement.
 *
 * Same shape as the active-intern check elsewhere in the codebase: lean
 * on EngagementStatus.ACTIVE specifically (not just "in-funnel"), so a
 * candidate still in PENDING_COMPLIANCE / READY_TO_START doesn't see the
 * supervisor's weekly drops yet.
 *
 * Audit actions (per task scope — release + ack only):
 *   - MATERIAL_RELEASED (entityType=WeeklyMaterial, entityId=material.id)
 *   - MATERIAL_ACKNOWLEDGED (entityType=WeeklyMaterial, entityId=material.id,
 *     userId=acknowledging candidate's user id)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WeeklyMaterialService {

    private static final Set<UserRole> ELEVATED_PUBLISHER_ROLES = EnumSet.of(
            UserRole.ADMIN, UserRole.ERM);

    private static final TypeReference<List<String>> URL_LIST_TYPE = new TypeReference<>() {};

    private final WeeklyMaterialRepository materialRepository;
    private final MaterialAcknowledgementRepository ackRepository;
    private final EngagementRepository engagementRepository;
    private final CandidateRepository candidateRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    // ── Supervisor commands ─────────────────────────────────────────────────

    @Transactional
    public WeeklyMaterialResponse create(CreateWeeklyMaterialRequest req, User actor) {
        Engagement engagement = resolveEngagementOrNull(req.getEngagementId(), actor);

        WeeklyMaterial material = WeeklyMaterial.builder()
                .weekNo(req.getWeekNo())
                .title(req.getTitle())
                .description(req.getDescription())
                .resourceUrlsJson(serializeUrls(req.getResourceUrls()))
                .dueDate(req.getDueDate())
                .publishedBy(actor)
                .engagement(engagement)
                .status(WeeklyMaterialStatus.DRAFT)
                .build();
        material = materialRepository.save(material);
        // No audit on CREATE per task scope — release is the public event.
        return toResponse(material, /* caller= */ actor, /* internAck= */ null);
    }

    @Transactional
    public WeeklyMaterialResponse update(UUID materialId,
                                         UpdateWeeklyMaterialRequest req,
                                         User actor) {
        WeeklyMaterial material = materialRepository.findByIdWithGraph(materialId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Weekly material not found: " + materialId));

        if (material.getStatus() != WeeklyMaterialStatus.DRAFT) {
            throw new BadRequestException(
                    "Cannot edit a released material. Create a follow-up week instead.");
        }
        // Only the publisher OR an elevated role may edit. Matches the release-gate.
        ensureCanManage(material, actor);

        if (req.getWeekNo() != null) material.setWeekNo(req.getWeekNo());
        if (req.getTitle() != null) material.setTitle(req.getTitle());
        if (req.getDescription() != null) material.setDescription(req.getDescription());
        if (req.getResourceUrls() != null) {
            material.setResourceUrlsJson(serializeUrls(req.getResourceUrls()));
        }
        if (req.getDueDate() != null) material.setDueDate(req.getDueDate());

        if (Boolean.TRUE.equals(req.getClearEngagement())) {
            material.setEngagement(null);
        } else if (req.getEngagementId() != null) {
            material.setEngagement(resolveEngagementOrNull(req.getEngagementId(), actor));
        }

        material = materialRepository.save(material);
        return toResponse(material, actor, null);
    }

    @Transactional
    public WeeklyMaterialResponse release(UUID materialId, User actor) {
        WeeklyMaterial material = materialRepository.findByIdWithGraph(materialId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Weekly material not found: " + materialId));

        if (material.getStatus() == WeeklyMaterialStatus.RELEASED) {
            // Idempotent re-release no-op — return the existing response without
            // re-stamping releaseDate / re-auditing. The supervisor probably
            // double-clicked.
            return toResponse(material, actor, null);
        }
        if (material.getStatus() != WeeklyMaterialStatus.DRAFT) {
            throw new BadRequestException(
                    "Only DRAFT materials can be released (current status: "
                            + material.getStatus() + ")");
        }
        ensureCanManage(material, actor);

        material.setStatus(WeeklyMaterialStatus.RELEASED);
        material.setReleaseDate(Instant.now());
        material = materialRepository.save(material);

        writeAudit(material.getId(), "MATERIAL_RELEASED", actor.getId(),
                Map.of(
                        "weekNo", material.getWeekNo(),
                        "title", material.getTitle(),
                        "engagementId", material.getEngagement() != null
                                ? material.getEngagement().getId() : null));
        return toResponse(material, actor, null);
    }

    @Transactional(readOnly = true)
    public List<WeeklyMaterialResponse> listMine(User actor) {
        return materialRepository
                .findByPublishedByIdOrderByCreatedAtDesc(actor.getId())
                .stream()
                .map(m -> toResponse(m, actor, /* internAck= */ null))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MaterialAcknowledgementResponse> listAcksForMaterial(UUID materialId,
                                                                     User actor) {
        WeeklyMaterial material = materialRepository.findByIdWithGraph(materialId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Weekly material not found: " + materialId));
        // Supervisor read-back: publisher OR elevated role. Same gate shape as edits.
        ensureCanManage(material, actor);
        return ackRepository.findByMaterialIdWithIntern(materialId)
                .stream()
                .map(this::toAckResponse)
                .toList();
    }

    // ── Intern commands ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<WeeklyMaterialResponse> getVisibleForIntern(User candidateUser) {
        Engagement active = requireActiveEngagement(candidateUser);
        UUID candidateId = active.getCandidate().getId();

        // Pre-fetch all acks for this intern so we can fold them into each
        // material response without a per-row query (no N+1).
        Map<UUID, MaterialAcknowledgement> acksByMaterial = ackRepository
                .findByInternId(candidateId).stream()
                .collect(Collectors.toMap(a -> a.getMaterial().getId(), a -> a,
                        (a, b) -> a));

        return materialRepository
                .findVisibleForEngagement(WeeklyMaterialStatus.RELEASED, active.getId())
                .stream()
                .map(m -> toResponse(m, candidateUser, acksByMaterial.get(m.getId())))
                .toList();
    }

    @Transactional
    public MaterialAcknowledgementResponse acknowledge(UUID materialId, User candidateUser) {
        Engagement active = requireActiveEngagement(candidateUser);
        Candidate candidate = active.getCandidate();
        WeeklyMaterial material = materialRepository.findByIdWithGraph(materialId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Weekly material not found: " + materialId));

        if (material.getStatus() != WeeklyMaterialStatus.RELEASED) {
            throw new BadRequestException(
                    "Cannot acknowledge a material that has not been released.");
        }
        // Visibility gate: scoped material must match this intern's engagement.
        if (material.getEngagement() != null
                && !material.getEngagement().getId().equals(active.getId())) {
            // Don't leak existence of materials this intern can't see.
            throw new ResourceNotFoundException(
                    "Weekly material not found: " + materialId);
        }

        // Idempotent: re-click returns the existing ack, no new row, no new audit.
        Optional<MaterialAcknowledgement> existing = ackRepository
                .findByMaterialIdAndInternId(material.getId(), candidate.getId());
        if (existing.isPresent()) {
            return toAckResponse(existing.get());
        }

        MaterialAcknowledgement ack = MaterialAcknowledgement.builder()
                .material(material)
                .intern(candidate)
                .build();
        ack = ackRepository.save(ack);

        writeAudit(material.getId(), "MATERIAL_ACKNOWLEDGED", candidateUser.getId(),
                Map.of(
                        "candidateId", candidate.getId(),
                        "weekNo", material.getWeekNo()));
        return toAckResponse(ack);
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    /**
     * Resolves an engagement reference for a scoped publish and enforces the
     * "engagement-supervisor or elevated role" gate (GAP B6 shape). Returns
     * null when the caller passed null (broadcast).
     */
    private Engagement resolveEngagementOrNull(UUID engagementId, User actor) {
        if (engagementId == null) return null;
        Engagement engagement = engagementRepository.findById(engagementId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Engagement not found: " + engagementId));
        // Elevated roles bypass the per-engagement supervisor check.
        if (isElevated(actor)) return engagement;
        // Otherwise must BE the engagement's supervisor.
        User supervisor = engagement.getSupervisor();
        if (supervisor == null || !supervisor.getId().equals(actor.getId())) {
            throw new ForbiddenException(
                    "Only this engagement's supervisor (or ERM/ADMIN) may publish to it.");
        }
        return engagement;
    }

    /**
     * Manage gate (edit / release / read acks): publisher OR an elevated role.
     * Used for actions that don't carry an explicit target engagement.
     */
    private void ensureCanManage(WeeklyMaterial material, User actor) {
        if (isElevated(actor)) return;
        User publisher = material.getPublishedBy();
        if (publisher == null || !publisher.getId().equals(actor.getId())) {
            throw new ForbiddenException(
                    "Only the original publisher (or ERM/ADMIN) may manage this material.");
        }
    }

    private boolean isElevated(User actor) {
        return actor != null && actor.getRoles() != null
                && actor.getRoles().stream().anyMatch(ELEVATED_PUBLISHER_ROLES::contains);
    }

    /**
     * Active-intern gate: candidate has an Engagement in status == ACTIVE.
     * Strictly ACTIVE — PENDING_COMPLIANCE / READY_TO_START don't see the
     * weekly cycle yet. Returns the engagement so callers can use its id.
     */
    private Engagement requireActiveEngagement(User candidateUser) {
        Candidate candidate = candidateRepository.findByUserId(candidateUser.getId())
                .orElseThrow(() -> new ForbiddenException(
                        "Weekly materials are available to active interns only."));
        List<Engagement> active = engagementRepository
                .findByCandidateIdAndStatus(candidate.getId(), EngagementStatus.ACTIVE);
        if (active.isEmpty()) {
            throw new ForbiddenException(
                    "Weekly materials are available to active interns only.");
        }
        // If multiple ACTIVE engagements somehow exist (data anomaly), pick the
        // newest — same fallback resolveActiveForCandidate uses.
        return active.stream()
                .max(java.util.Comparator.comparing(Engagement::getCreatedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                .orElse(active.get(0));
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    public WeeklyMaterialResponse toResponse(WeeklyMaterial m,
                                             User viewer,
                                             MaterialAcknowledgement internAck) {
        // Supervisor-view ack count is cheap (count by material). Intern-view
        // gets the per-row ack object instead.
        Long ackCount = null;
        if (viewer != null && m.getPublishedBy() != null
                && viewer.getId().equals(m.getPublishedBy().getId())
                && m.getStatus() == WeeklyMaterialStatus.RELEASED) {
            ackCount = ackRepository.countByMaterialId(m.getId());
        }

        Engagement eng = m.getEngagement();
        String scopedName = null;
        if (eng != null && eng.getCandidate() != null && eng.getCandidate().getUser() != null) {
            scopedName = eng.getCandidate().getUser().getFullName();
        }

        return WeeklyMaterialResponse.builder()
                .id(m.getId())
                .weekNo(m.getWeekNo())
                .title(m.getTitle())
                .description(m.getDescription())
                .resourceUrls(deserializeUrls(m.getResourceUrlsJson()))
                .dueDate(m.getDueDate())
                .releaseDate(m.getReleaseDate())
                .publishedById(m.getPublishedBy() != null ? m.getPublishedBy().getId() : null)
                .publishedByName(m.getPublishedBy() != null ? m.getPublishedBy().getFullName() : null)
                .engagementId(eng != null ? eng.getId() : null)
                .scopedToCandidateName(scopedName)
                .status(m.getStatus())
                .createdAt(m.getCreatedAt())
                .acknowledged(internAck != null)
                .acknowledgedAt(internAck != null ? internAck.getAcknowledgedAt() : null)
                .acknowledgementCount(ackCount)
                .build();
    }

    private MaterialAcknowledgementResponse toAckResponse(MaterialAcknowledgement a) {
        Candidate intern = a.getIntern();
        User internUser = intern != null ? intern.getUser() : null;
        return MaterialAcknowledgementResponse.builder()
                .id(a.getId())
                .materialId(a.getMaterial() != null ? a.getMaterial().getId() : null)
                .internCandidateId(intern != null ? intern.getId() : null)
                .internName(internUser != null ? internUser.getFullName() : null)
                .internEmail(internUser != null ? internUser.getEmail() : null)
                .acknowledgedAt(a.getAcknowledgedAt())
                .build();
    }

    // ── JSON list (resource URLs) ───────────────────────────────────────────

    private String serializeUrls(List<String> urls) {
        if (urls == null || urls.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(urls);
        } catch (JsonProcessingException e) {
            // List<String> serialization can't realistically fail; fall back to
            // a stable representation rather than crash.
            log.warn("Failed to serialize resourceUrls: {}", e.getMessage());
            return urls.toString();
        }
    }

    private List<String> deserializeUrls(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, URL_LIST_TYPE);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse stored resourceUrls JSON, returning empty: {}",
                    e.getMessage());
            return List.of();
        }
    }

    // ── Audit log (release / ack only — task scope) ─────────────────────────

    private void writeAudit(UUID materialId, String action, UUID userId,
                            Map<String, Object> snapshot) {
        Map<String, Object> after = snapshot != null
                ? new LinkedHashMap<>(snapshot) : Collections.emptyMap();
        AuditLog entry = AuditLog.builder()
                .entityType("WeeklyMaterial")
                .entityId(materialId)
                .action(action)
                .userId(userId)
                .afterJson(serializeJson(after))
                .build();
        auditLogRepository.save(entry);
    }

    private String serializeJson(Map<String, Object> snapshot) {
        if (snapshot == null) return null;
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize material audit snapshot: {}", e.getMessage());
            return new HashMap<>(snapshot).toString();
        }
    }
}
