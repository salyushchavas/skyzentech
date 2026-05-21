package com.skyzen.careers.controller;

import com.skyzen.careers.dto.screening.ScreeningCandidateResponse;
import com.skyzen.careers.dto.screening.ScreeningStaffResponse;
import com.skyzen.careers.dto.screening.ScreeningSubmitRequest;
import com.skyzen.careers.dto.screening.ScreeningSummaryResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.ScreeningService;
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

import java.util.UUID;

/**
 * Endpoints for phase 2.1 lightweight screening.
 *
 *   POST /api/v1/applications/{id}/screening/send  (staff)  -> send a screening
 *   GET  /api/v1/screening/{id}                    (owner)  -> questions to answer
 *   POST /api/v1/screening/{id}/submit             (owner)  -> submit answers
 *   GET  /api/v1/applications/{id}/screening       (staff)  -> result + score
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class ScreeningController {

    private final ScreeningService screeningService;

    @PostMapping("/applications/{applicationId}/screening/send")
    @PreAuthorize("hasAnyRole('RECRUITER', 'ERM', 'ADMIN')")
    public ResponseEntity<ScreeningSummaryResponse> send(
            @PathVariable UUID applicationId,
            @AuthenticationPrincipal User caller) {
        return ResponseEntity.ok(screeningService.send(applicationId, caller));
    }

    @GetMapping("/screening/{id}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ScreeningCandidateResponse getForCandidate(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        return screeningService.getForCandidate(id, caller);
    }

    @PostMapping("/screening/{id}/submit")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ScreeningSummaryResponse submit(
            @PathVariable UUID id,
            @Valid @RequestBody ScreeningSubmitRequest req,
            @AuthenticationPrincipal User caller) {
        return screeningService.submit(id, req, caller);
    }

    @GetMapping("/applications/{applicationId}/screening")
    @PreAuthorize("hasAnyRole('RECRUITER', 'ERM', 'ADMIN', 'HR_COMPLIANCE')")
    public ScreeningStaffResponse getForStaff(
            @PathVariable UUID applicationId,
            @AuthenticationPrincipal User caller) {
        return screeningService.getForApplicationStaff(applicationId, caller);
    }
}
