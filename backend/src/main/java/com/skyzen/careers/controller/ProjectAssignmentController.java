package com.skyzen.careers.controller;

import com.skyzen.careers.dto.project.catalog.AssignProjectRequest;
import com.skyzen.careers.dto.project.catalog.AssignProjectResultResponse;
import com.skyzen.careers.dto.project.catalog.EligibleInternResponse;
import com.skyzen.careers.dto.project.catalog.ProjectAssignmentResponse;
import com.skyzen.careers.dto.project.catalog.ReturnAssignmentRequest;
import com.skyzen.careers.dto.project.catalog.SubmitAssignmentRequest;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ProjectAssignmentStatus;
import com.skyzen.careers.service.ProjectAssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/project-assignments")
@RequiredArgsConstructor
public class ProjectAssignmentController {

    private final ProjectAssignmentService service;

    @PostMapping
    @PreAuthorize("hasAnyRole('TECHNICAL_EVALUATOR', 'SUPER_ADMIN')")
    public AssignProjectResultResponse assign(
            @Valid @RequestBody AssignProjectRequest req,
            @AuthenticationPrincipal User caller) {
        return service.assignToInterns(req, caller);
    }

    @PostMapping("/{id}/access-granted")
    @PreAuthorize("hasAnyRole('TECHNICAL_EVALUATOR', 'SUPER_ADMIN')")
    public ProjectAssignmentResponse markAccessGranted(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        return service.markAccessGranted(id, caller);
    }

    @DeleteMapping("/{id}/access-granted")
    @PreAuthorize("hasAnyRole('TECHNICAL_EVALUATOR', 'SUPER_ADMIN')")
    public ProjectAssignmentResponse revokeAccessGranted(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        return service.revokeAccessGranted(id, caller);
    }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasAnyRole('INTERN', 'APPLICANT')")
    public ProjectAssignmentResponse start(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        return service.startAssignment(id, caller);
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAnyRole('INTERN', 'APPLICANT')")
    public ProjectAssignmentResponse submit(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) SubmitAssignmentRequest req,
            @AuthenticationPrincipal User caller) {
        String notes = req != null ? req.submissionNotes() : null;
        return service.submitAssignment(id, notes, caller);
    }

    @GetMapping("/mine")
    @PreAuthorize("hasAnyRole('INTERN', 'APPLICANT')")
    public List<ProjectAssignmentResponse> mine(@AuthenticationPrincipal User caller) {
        return service.listForIntern(caller.getId());
    }

    @GetMapping("/by-project/{projectId}")
    @PreAuthorize("hasAnyRole('TECHNICAL_EVALUATOR', 'SUPER_ADMIN')")
    public List<ProjectAssignmentResponse> byProject(@PathVariable UUID projectId) {
        return service.listForProject(projectId);
    }

    @GetMapping("/eligible-interns")
    @PreAuthorize("hasAnyRole('TECHNICAL_EVALUATOR', 'SUPER_ADMIN')")
    public List<EligibleInternResponse> eligibleInterns() {
        return service.eligibleInterns();
    }

    // ── Reviewer lifecycle (TE + RM) ───────────────────────────────────────

    @PostMapping("/{id}/tech-approve")
    @PreAuthorize("hasAnyRole('TECHNICAL_EVALUATOR', 'SUPER_ADMIN')")
    public ProjectAssignmentResponse techApprove(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        return service.techApprove(id, caller);
    }

    @PostMapping("/{id}/return-revisions")
    @PreAuthorize("hasAnyRole('TECHNICAL_EVALUATOR', 'REPORTING_MANAGER', 'SUPER_ADMIN')")
    public ProjectAssignmentResponse returnForRevisions(
            @PathVariable UUID id,
            @Valid @RequestBody ReturnAssignmentRequest req,
            @AuthenticationPrincipal User caller) {
        return service.returnForRevisions(id, req.reason(), caller);
    }

    @PostMapping("/{id}/mark-pending-viva")
    @PreAuthorize("hasAnyRole('REPORTING_MANAGER', 'SUPER_ADMIN')")
    public ProjectAssignmentResponse markPendingViva(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        return service.markPendingViva(id, caller);
    }

    @PostMapping("/{id}/complete-after-viva")
    @PreAuthorize("hasAnyRole('REPORTING_MANAGER', 'SUPER_ADMIN')")
    public ProjectAssignmentResponse completeAfterViva(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        return service.completeAfterViva(id, caller);
    }

    /**
     * Status-filtered roster. TE uses {@code ?status=SUBMITTED} for the
     * tech-review queue; RM uses {@code ?status=TECH_APPROVED&status=PENDING_VIVA}
     * for the viva queue. Both roles may read either filter — the dashboards
     * decide which slice to show.
     */
    @GetMapping("/by-status")
    @PreAuthorize("hasAnyRole('TECHNICAL_EVALUATOR', 'REPORTING_MANAGER', 'SUPER_ADMIN')")
    public List<ProjectAssignmentResponse> byStatus(
            @RequestParam("status") List<ProjectAssignmentStatus> statuses) {
        return service.listByStatuses(statuses);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TECHNICAL_EVALUATOR', 'SUPER_ADMIN', 'INTERN', 'APPLICANT')")
    public ProjectAssignmentResponse get(@PathVariable UUID id,
                                          @AuthenticationPrincipal User caller) {
        return service.getAssignment(id, caller);
    }
}
