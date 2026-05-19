package com.skyzen.careers.controller;

import com.skyzen.careers.dto.i983.CreateI983Request;
import com.skyzen.careers.dto.i983.DsoResponseRequest;
import com.skyzen.careers.dto.i983.I983HistoryEntryResponse;
import com.skyzen.careers.dto.i983.I983PlanResponse;
import com.skyzen.careers.dto.i983.I983SummaryResponse;
import com.skyzen.careers.dto.i983.SubmitToDsoRequest;
import com.skyzen.careers.dto.i983.UpdateI983Request;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.I983Status;
import com.skyzen.careers.service.I983Service;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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
@RequestMapping("/api/v1/i983")
@RequiredArgsConstructor
public class I983Controller {

    private final I983Service service;

    @PostMapping
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public ResponseEntity<I983PlanResponse> create(
            @Valid @RequestBody CreateI983Request req,
            @AuthenticationPrincipal User user) {
        I983PlanResponse created = service.toResponse(service.createPlan(req, user));
        return ResponseEntity.created(URI.create("/api/v1/i983/" + created.getId()))
                .body(created);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ERM', 'ADMIN')")
    public Page<I983SummaryResponse> list(
            @RequestParam(required = false) I983Status status,
            @RequestParam(required = false) UUID candidateId,
            @RequestParam(required = false) UUID entityId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(
                Math.max(0, page),
                Math.min(100, Math.max(1, size)),
                Sort.by(Sort.Direction.DESC, "updatedAt"));
        return service.list(status, candidateId, entityId, pageable);
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public List<I983PlanResponse> getMyPlans(@AuthenticationPrincipal User user) {
        return service.getMyPlans(user);
    }

    @GetMapping("/candidate/{candidateId}")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ERM', 'ADMIN')")
    public List<I983PlanResponse> getForCandidate(@PathVariable UUID candidateId) {
        return service.getForCandidate(candidateId);
    }

    @GetMapping("/{id}")
    public I983PlanResponse getOne(@PathVariable UUID id,
                                   @AuthenticationPrincipal User user) {
        return service.toResponse(service.getById(id, user));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public I983PlanResponse update(@PathVariable UUID id,
                                   @Valid @RequestBody UpdateI983Request req,
                                   @AuthenticationPrincipal User user) {
        return service.toResponse(service.updateFields(id, req, user));
    }

    @PostMapping("/{id}/sign-employer")
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public I983PlanResponse signEmployer(@PathVariable UUID id,
                                         @AuthenticationPrincipal User user) {
        return service.toResponse(service.signEmployer(id, user));
    }

    @PostMapping("/{id}/sign-student")
    @PreAuthorize("hasRole('CANDIDATE')")
    public I983PlanResponse signStudent(@PathVariable UUID id,
                                        @AuthenticationPrincipal User user) {
        return service.toResponse(service.signStudent(id, user));
    }

    @PostMapping("/{id}/submit-to-dso")
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public I983PlanResponse submitToDso(
            @PathVariable UUID id,
            @RequestBody(required = false) SubmitToDsoRequest req,
            @AuthenticationPrincipal User user) {
        return service.toResponse(service.submitToDso(id, req, user));
    }

    @PostMapping("/{id}/dso-response")
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public I983PlanResponse recordDsoResponse(
            @PathVariable UUID id,
            @Valid @RequestBody DsoResponseRequest req,
            @AuthenticationPrincipal User user) {
        return service.toResponse(service.recordDsoResponse(id, req, user));
    }

    @GetMapping("/{id}/history")
    public List<I983HistoryEntryResponse> getHistory(@PathVariable UUID id,
                                                     @AuthenticationPrincipal User user) {
        return service.getHistory(id, user);
    }
}
