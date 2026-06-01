package com.skyzen.careers.controller;

import com.skyzen.careers.dto.engagement.EngagementResponse;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.service.ComplianceRoutingService;
import com.skyzen.careers.service.EngagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Phase 3 step 9 — engagement read + HR transition actions.
 *
 *   GET  /api/v1/engagements/{id}            (HR/ERM/ADMIN read)
 *   POST /api/v1/engagements/{id}/mark-ready (HR/ERM/ADMIN — gates on requirements)
 *   POST /api/v1/engagements/{id}/start      (HR/ERM/ADMIN — manual READY → ACTIVE)
 *
 * The list of "missing requirements" is computed by
 * {@link ComplianceRoutingService#missingRequirements} per the engagement's
 * track snapshot (I-9 / I-983 / E-Verify / CPT_I20_VERIFY).
 */
@RestController
@RequestMapping("/api/v1/engagements")
@RequiredArgsConstructor
public class EngagementController {

    private final EngagementRepository engagementRepository;
    private final EngagementService engagementService;
    private final ComplianceRoutingService complianceRoutingService;
    private final UserRepository userRepository;
    private final com.skyzen.careers.service.EngagementActivationService engagementActivationService;

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'HR_COMPLIANCE')")
    @Transactional(readOnly = true)
    public EngagementResponse getOne(@PathVariable UUID id) {
        Engagement engagement = engagementRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Engagement not found: " + id));
        return toResponse(engagement);
    }

    /**
     * Activation-readiness signal used by HR/Ops UI to decide whether to
     * render the "Activate Engagement" button on a PENDING_COMPLIANCE row.
     * Pure read — never mutates. The actual transition still goes through
     * {@code POST /mark-ready} on this controller.
     */
    @GetMapping("/{id}/activation-readiness")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'OPERATIONS', 'SUPER_ADMIN')")
    @Transactional(readOnly = true)
    public ActivationReadinessResponse activationReadiness(@PathVariable UUID id) {
        Engagement engagement = engagementRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Engagement not found: " + id));
        boolean ready = engagementActivationService.isReady(engagement);
        var missing = complianceRoutingService.missingRequirements(engagement);
        return new ActivationReadinessResponse(ready, missing);
    }

    /**
     * List of PENDING_COMPLIANCE engagements that are READY to activate,
     * scoped for HR's landing dashboard. Pure read — every row carries
     * the same minimal payload the operations onboarding queue uses so the
     * frontend can render the inline "Activate Engagement" button.
     */
    @GetMapping("/awaiting-activation")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'OPERATIONS', 'SUPER_ADMIN')")
    @Transactional(readOnly = true)
    public java.util.List<AwaitingActivationRow> awaitingActivation() {
        java.util.List<Engagement> pending = engagementRepository
                .findByStatus(com.skyzen.careers.enums.EngagementStatus.PENDING_COMPLIANCE);
        java.util.List<AwaitingActivationRow> rows = new java.util.ArrayList<>();
        for (Engagement e : pending) {
            if (!engagementActivationService.isReady(e)) continue;
            var candidate = e.getCandidate();
            var candidateUser = candidate != null ? candidate.getUser() : null;
            var application = e.getApplication();
            var posting = application != null ? application.getJobPosting() : null;
            rows.add(new AwaitingActivationRow(
                    e.getId(),
                    candidate != null ? candidate.getId() : null,
                    candidateUser != null ? candidateUser.getFullName() : null,
                    posting != null ? posting.getTitle() : null
            ));
        }
        return rows;
    }

    /** Lightweight readiness DTO inlined here — no other surface needs it. */
    public record ActivationReadinessResponse(
            boolean ready,
            java.util.List<String> missing) {}

    /** Minimal row payload for the HR / Ops awaiting-activation list. */
    public record AwaitingActivationRow(
            UUID engagementId,
            UUID candidateId,
            String candidateName,
            String position) {}

    @PostMapping("/{id}/mark-ready")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'HR_COMPLIANCE')")
    @Transactional
    public ResponseEntity<EngagementResponse> markReady(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        Engagement engagement = engagementRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Engagement not found: " + id));
        Engagement updated = engagementService.markReady(engagement, complianceRoutingService, caller);
        return ResponseEntity.ok(toResponse(updated));
    }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'HR_COMPLIANCE')")
    @Transactional
    public ResponseEntity<EngagementResponse> start(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        Engagement engagement = engagementRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Engagement not found: " + id));
        Engagement updated = engagementService.startEngagement(engagement, caller);
        return ResponseEntity.ok(toResponse(updated));
    }

    /**
     * Two-role workflow prerequisite — assign the Reporting Manager who
     * runs the post-merge viva and signs final project completion. Pass
     * {@code reportingManagerUserId: null} to unassign. The target user
     * MUST hold the {@code REPORTING_MANAGER} role.
     */
    @PatchMapping("/{id}/reporting-manager")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<EngagementResponse> setReportingManager(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {
        Engagement engagement = engagementRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Engagement not found: " + id));
        String raw = body != null ? body.get("reportingManagerUserId") : null;
        if (raw == null || raw.isBlank() || "null".equals(raw)) {
            engagement.setReportingManager(null);
        } else {
            UUID userId;
            try {
                userId = UUID.fromString(raw);
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Malformed reportingManagerUserId");
            }
            User user = userRepository.findById(userId).orElseThrow(
                    () -> new ResourceNotFoundException("User not found: " + userId));
            if (user.getRoles() == null
                    || !user.getRoles().contains(UserRole.REPORTING_MANAGER)) {
                throw new BadRequestException(
                        "User " + userId + " does not hold the REPORTING_MANAGER role.");
            }
            engagement.setReportingManager(user);
        }
        engagementRepository.save(engagement);
        return ResponseEntity.ok(toResponse(engagement));
    }

    private EngagementResponse toResponse(Engagement e) {
        var missing = complianceRoutingService.missingRequirements(e);
        var candidate = e.getCandidate();
        var candidateUser = candidate != null ? candidate.getUser() : null;
        var application = e.getApplication();
        var posting = application != null ? application.getJobPosting() : null;
        var supervisor = e.getSupervisor();
        return EngagementResponse.builder()
                .id(e.getId())
                .applicationId(application != null ? application.getId() : null)
                .candidateId(candidate != null ? candidate.getId() : null)
                .offerId(e.getOffer() != null ? e.getOffer().getId() : null)
                .entityId(e.getEntity() != null ? e.getEntity().getId() : null)
                .candidateName(candidateUser != null ? candidateUser.getFullName() : null)
                .candidateEmail(candidateUser != null ? candidateUser.getEmail() : null)
                .entityName(e.getEntity() != null ? e.getEntity().getName() : null)
                .jobPostingTitle(posting != null ? posting.getTitle() : null)
                .track(e.getTrack())
                .status(e.getStatus())
                .plannedStartDate(e.getPlannedStartDate())
                .plannedEndDate(e.getPlannedEndDate())
                .actualStartDate(e.getActualStartDate())
                .actualEndDate(e.getActualEndDate())
                .supervisorId(supervisor != null ? supervisor.getId() : null)
                .supervisorName(supervisor != null ? supervisor.getFullName() : null)
                .worksite(e.getWorksite())
                .hoursPerWeek(e.getHoursPerWeek())
                .missingRequirements(missing)
                .readyToStart(missing.isEmpty())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
