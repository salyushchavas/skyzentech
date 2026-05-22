package com.skyzen.careers.controller;

import com.skyzen.careers.dto.engagement.EngagementResponse;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.User;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ERM', 'ADMIN', 'RECRUITER')")
    @Transactional(readOnly = true)
    public EngagementResponse getOne(@PathVariable UUID id) {
        Engagement engagement = engagementRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Engagement not found: " + id));
        return toResponse(engagement);
    }

    @PostMapping("/{id}/mark-ready")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ERM', 'ADMIN')")
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
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ERM', 'ADMIN')")
    @Transactional
    public ResponseEntity<EngagementResponse> start(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        Engagement engagement = engagementRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Engagement not found: " + id));
        Engagement updated = engagementService.startEngagement(engagement, caller);
        return ResponseEntity.ok(toResponse(updated));
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
