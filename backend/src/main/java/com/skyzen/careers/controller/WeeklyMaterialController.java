package com.skyzen.careers.controller;

import com.skyzen.careers.dto.material.CreateWeeklyMaterialRequest;
import com.skyzen.careers.dto.material.MaterialAcknowledgementResponse;
import com.skyzen.careers.dto.material.UpdateWeeklyMaterialRequest;
import com.skyzen.careers.dto.material.WeeklyMaterialResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.WeeklyMaterialService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * GAP_REPORT C1 + D4 — weekly training materials.
 *
 * Roles per endpoint:
 *   - Supervisor-side (create / update / release / publisher list / read acks):
 *     hasAnyRole('ERM', 'TECHNICAL_EVALUATOR', 'ADMIN')
 *   - Intern-side (visible feed / acknowledge):
 *     hasRole('CANDIDATE')
 *
 * Service enforces the engagement-supervisor gate on scoped publishes
 * (GAP B6 shape) and the active-intern visibility gate.
 */
@RestController
@RequestMapping("/api/v1/weekly-materials")
@RequiredArgsConstructor
public class WeeklyMaterialController {

    private final WeeklyMaterialService service;

    // ── Supervisor commands ─────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('ERM', 'TECHNICAL_EVALUATOR', 'ADMIN')")
    public ResponseEntity<WeeklyMaterialResponse> create(
            @Valid @RequestBody CreateWeeklyMaterialRequest req,
            @AuthenticationPrincipal User user) {
        WeeklyMaterialResponse created = service.create(req, user);
        return ResponseEntity.created(URI.create("/api/v1/weekly-materials/" + created.getId()))
                .body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'TECHNICAL_EVALUATOR', 'ADMIN')")
    public WeeklyMaterialResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateWeeklyMaterialRequest req,
            @AuthenticationPrincipal User user) {
        return service.update(id, req, user);
    }

    @PostMapping("/{id}/release")
    @PreAuthorize("hasAnyRole('ERM', 'TECHNICAL_EVALUATOR', 'ADMIN')")
    public WeeklyMaterialResponse release(@PathVariable UUID id,
                                          @AuthenticationPrincipal User user) {
        return service.release(id, user);
    }

    /** Materials this supervisor has published (DRAFT + RELEASED). Newest first. */
    @GetMapping("/published")
    @PreAuthorize("hasAnyRole('ERM', 'TECHNICAL_EVALUATOR', 'ADMIN')")
    public List<WeeklyMaterialResponse> listMine(@AuthenticationPrincipal User user) {
        return service.listMine(user);
    }

    /** Per-material ack roster (which interns acknowledged + when). */
    @GetMapping("/{id}/acknowledgements")
    @PreAuthorize("hasAnyRole('ERM', 'TECHNICAL_EVALUATOR', 'ADMIN')")
    public List<MaterialAcknowledgementResponse> listAcks(@PathVariable UUID id,
                                                          @AuthenticationPrincipal User user) {
        return service.listAcksForMaterial(id, user);
    }

    // ── Intern commands ─────────────────────────────────────────────────────

    /** Released materials visible to this ACTIVE intern (broadcast OR engagement-scoped). */
    @GetMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public List<WeeklyMaterialResponse> listForMe(@AuthenticationPrincipal User user) {
        return service.getVisibleForIntern(user);
    }

    @PostMapping("/{id}/acknowledge")
    @PreAuthorize("hasRole('CANDIDATE')")
    public MaterialAcknowledgementResponse acknowledge(@PathVariable UUID id,
                                                       @AuthenticationPrincipal User user) {
        return service.acknowledge(id, user);
    }
}
