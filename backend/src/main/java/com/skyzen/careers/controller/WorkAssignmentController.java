package com.skyzen.careers.controller;

import com.skyzen.careers.dto.supervised.AssignmentResponse;
import com.skyzen.careers.dto.supervised.CreateAssignmentRequest;
import com.skyzen.careers.dto.supervised.ReviewAssignmentRequest;
import com.skyzen.careers.dto.supervised.SubmitAssignmentRequest;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.WorkAssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supervised")
@RequiredArgsConstructor
public class WorkAssignmentController {

    private final WorkAssignmentService workAssignmentService;

    @PostMapping("/interns/{candidateId}/assignments")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'TECHNICAL_EVALUATOR')")
    public ResponseEntity<AssignmentResponse> create(
            @PathVariable UUID candidateId,
            @Valid @RequestBody CreateAssignmentRequest req,
            @AuthenticationPrincipal User caller) {
        AssignmentResponse created = workAssignmentService.create(candidateId, req, caller);
        return ResponseEntity.created(URI.create("/api/v1/supervised/assignments/" + created.getId()))
                .body(created);
    }

    @GetMapping("/interns/{candidateId}/assignments")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'HR', 'TECHNICAL_EVALUATOR')")
    public List<AssignmentResponse> listForIntern(@PathVariable UUID candidateId) {
        return workAssignmentService.listForIntern(candidateId);
    }

    @GetMapping("/my/assignments")
    @PreAuthorize("hasAnyRole('APPLICANT', 'INTERN')")
    public List<AssignmentResponse> listMine(@AuthenticationPrincipal User caller) {
        return workAssignmentService.listForCandidateUser(caller);
    }

    @PostMapping("/assignments/{id}/start")
    @PreAuthorize("hasAnyRole('APPLICANT', 'INTERN')")
    public AssignmentResponse start(@PathVariable UUID id,
                                    @AuthenticationPrincipal User caller) {
        return workAssignmentService.start(id, caller);
    }

    @PostMapping("/assignments/{id}/submit")
    @PreAuthorize("hasAnyRole('APPLICANT', 'INTERN')")
    public AssignmentResponse submit(@PathVariable UUID id,
                                     @Valid @RequestBody SubmitAssignmentRequest req,
                                     @AuthenticationPrincipal User caller) {
        return workAssignmentService.submit(id, req, caller);
    }

    @PostMapping("/assignments/{id}/review")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'TECHNICAL_EVALUATOR')")
    public AssignmentResponse review(@PathVariable UUID id,
                                     @Valid @RequestBody ReviewAssignmentRequest req,
                                     @AuthenticationPrincipal User caller) {
        return workAssignmentService.review(id, req, caller);
    }
}
