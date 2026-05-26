package com.skyzen.careers.controller;

import com.skyzen.careers.dto.candidate.CandidateDashboardResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.CandidateDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Aggregate read endpoint for the candidate dashboard. One round-trip
 * powers the next-step card, application stepper, upcoming events, and the
 * recent-activity feed.
 */
@RestController
@RequestMapping("/api/v1/candidate")
@RequiredArgsConstructor
public class CandidateDashboardController {

    private final CandidateDashboardService candidateDashboardService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('APPLICANT', 'INTERN')")
    public CandidateDashboardResponse dashboard(@AuthenticationPrincipal User caller) {
        return candidateDashboardService.build(caller);
    }
}
