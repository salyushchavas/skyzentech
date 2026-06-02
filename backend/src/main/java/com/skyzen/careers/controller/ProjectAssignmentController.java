package com.skyzen.careers.controller;

import com.skyzen.careers.dto.project.catalog.AssignProjectRequest;
import com.skyzen.careers.dto.project.catalog.AssignProjectResultResponse;
import com.skyzen.careers.dto.project.catalog.EligibleInternResponse;
import com.skyzen.careers.dto.project.catalog.ProjectAssignmentResponse;
import com.skyzen.careers.dto.project.catalog.SubmitAssignmentRequest;
import com.skyzen.careers.entity.User;
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
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public AssignProjectResultResponse assign(
            @Valid @RequestBody AssignProjectRequest req,
            @AuthenticationPrincipal User caller) {
        return service.assignToInterns(req, caller);
    }

    @PostMapping("/{id}/access-granted")
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public ProjectAssignmentResponse markAccessGranted(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        return service.markAccessGranted(id, caller);
    }

    @DeleteMapping("/{id}/access-granted")
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
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
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public List<ProjectAssignmentResponse> byProject(@PathVariable UUID projectId) {
        return service.listForProject(projectId);
    }

    @GetMapping("/eligible-interns")
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public List<EligibleInternResponse> eligibleInterns() {
        return service.eligibleInterns();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN', 'INTERN', 'APPLICANT')")
    public ProjectAssignmentResponse get(@PathVariable UUID id,
                                          @AuthenticationPrincipal User caller) {
        return service.getAssignment(id, caller);
    }
}
