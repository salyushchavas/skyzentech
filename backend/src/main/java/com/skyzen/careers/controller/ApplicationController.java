package com.skyzen.careers.controller;

import com.skyzen.careers.dto.ApplicationCreateRequest;
import com.skyzen.careers.dto.ApplicationResponse;
import com.skyzen.careers.dto.ApplicationStatusUpdateRequest;
import com.skyzen.careers.dto.RecruiterDecisionRequest;
import com.skyzen.careers.dto.common.PagedResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.service.ApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;

    @PostMapping
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<ApplicationResponse> apply(
            @Valid @RequestBody ApplicationCreateRequest req,
            @AuthenticationPrincipal User user) {
        ApplicationResponse created = applicationService.apply(user, req);
        return ResponseEntity.created(URI.create("/api/v1/applications/" + created.getId()))
                .body(created);
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public List<ApplicationResponse> listMine(@AuthenticationPrincipal User user) {
        return applicationService.listForCandidate(user);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('RECRUITER', 'ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public PagedResponse<ApplicationResponse> list(
            @RequestParam(required = false) ApplicationStatus status,
            @RequestParam(required = false) UUID jobPostingId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)),
                Sort.by(Sort.Direction.DESC, "appliedAt"));
        return PagedResponse.of(applicationService.search(status, jobPostingId, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('CANDIDATE', 'RECRUITER', 'ERM', 'HR_COMPLIANCE', 'TECHNICAL_EVALUATOR', 'ADMIN')")
    public ApplicationResponse getOne(@PathVariable UUID id,
                                      @AuthenticationPrincipal User user) {
        // CANDIDATE is gated to their own application in ApplicationService.findById;
        // this controller guard is defense-in-depth so an unauthenticated request
        // is rejected before the service runs.
        return applicationService.findById(id, user);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECRUITER', 'ERM')")
    public ApplicationResponse updateStatus(@PathVariable UUID id,
                                            @Valid @RequestBody ApplicationStatusUpdateRequest req,
                                            @AuthenticationPrincipal User user) {
        return applicationService.updateStatus(id, req, user);
    }

    /**
     * One-click Shortlist from the recruiter review screen. Accepts an optional
     * {rating, note} body; persists those alongside the status transition. Routes
     * through the same status-transition service as the Kanban drag; adds a
     * SHORTLIST audit entry. Idempotent — returns 200 even if already SHORTLISTED.
     */
    @PostMapping("/{id}/shortlist")
    @PreAuthorize("hasAnyRole('RECRUITER', 'ERM', 'ADMIN')")
    public ApplicationResponse shortlist(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) RecruiterDecisionRequest req,
            @AuthenticationPrincipal User user) {
        return applicationService.shortlist(id, req, user);
    }

    /** Mirror of {@link #shortlist} for one-click rejection. Adds a REJECT audit entry. */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('RECRUITER', 'ERM', 'ADMIN')")
    public ApplicationResponse reject(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) RecruiterDecisionRequest req,
            @AuthenticationPrincipal User user) {
        return applicationService.reject(id, req, user);
    }
}
