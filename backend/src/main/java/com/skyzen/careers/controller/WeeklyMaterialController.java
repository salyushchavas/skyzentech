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
 * Weekly training materials — Phase-2 weekly cycle, piece #1.
 *
 * <h2>Roles per endpoint</h2>
 * <ul>
 *   <li>Supervisor commands (create / update / release / publisher list /
 *       per-material ack roster): {@code TECHNICAL_SUPERVISOR} or
 *       {@code SUPER_ADMIN}.</li>
 *   <li>Intern commands (visible feed / acknowledge): {@code INTERN} only.
 *       APPLICANT is intentionally excluded — weekly materials are part of
 *       the post-hire training cycle, and the service-level
 *       active-engagement gate would 403 an APPLICANT anyway.</li>
 * </ul>
 *
 * <h2>Service-enforced gates beyond @PreAuthorize</h2>
 * <ul>
 *   <li>Scoped publish: caller must own the engagement (be its supervisor)
 *       OR hold SUPER_ADMIN. TECHNICAL_SUPERVISOR is scoped to their own
 *       roster — SUPER_ADMIN bypasses.</li>
 *   <li>Active-intern visibility: the intern must have an Engagement in
 *       status ACTIVE — PENDING_COMPLIANCE / READY_TO_START don't see the
 *       weekly cycle yet.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/weekly-materials")
@RequiredArgsConstructor
public class WeeklyMaterialController {

    private final WeeklyMaterialService service;

    // ── Supervisor commands ─────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public ResponseEntity<WeeklyMaterialResponse> create(
            @Valid @RequestBody CreateWeeklyMaterialRequest req,
            @AuthenticationPrincipal User user) {
        WeeklyMaterialResponse created = service.create(req, user);
        return ResponseEntity.created(URI.create("/api/v1/weekly-materials/" + created.getId()))
                .body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public WeeklyMaterialResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateWeeklyMaterialRequest req,
            @AuthenticationPrincipal User user) {
        return service.update(id, req, user);
    }

    @PostMapping("/{id}/release")
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public WeeklyMaterialResponse release(@PathVariable UUID id,
                                          @AuthenticationPrincipal User user) {
        return service.release(id, user);
    }

    /** Materials this supervisor has published (DRAFT + RELEASED). Newest first. */
    @GetMapping("/published")
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public List<WeeklyMaterialResponse> listMine(@AuthenticationPrincipal User user) {
        return service.listMine(user);
    }

    /** Per-material ack roster (which interns acknowledged + when). */
    @GetMapping("/{id}/acknowledgements")
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public List<MaterialAcknowledgementResponse> listAcks(@PathVariable UUID id,
                                                          @AuthenticationPrincipal User user) {
        return service.listAcksForMaterial(id, user);
    }

    // ── Intern commands ─────────────────────────────────────────────────────

    /** Released materials visible to this ACTIVE intern (broadcast OR engagement-scoped). */
    @GetMapping("/me")
    @PreAuthorize("hasRole('INTERN')")
    public List<WeeklyMaterialResponse> listForMe(@AuthenticationPrincipal User user) {
        return service.getVisibleForIntern(user);
    }

    @PostMapping("/{id}/acknowledge")
    @PreAuthorize("hasRole('INTERN')")
    public MaterialAcknowledgementResponse acknowledge(@PathVariable UUID id,
                                                       @AuthenticationPrincipal User user) {
        return service.acknowledge(id, user);
    }
}
