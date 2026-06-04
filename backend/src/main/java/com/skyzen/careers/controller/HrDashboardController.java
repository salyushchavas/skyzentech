package com.skyzen.careers.controller;

import com.skyzen.careers.dto.hr.HrDashboardResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.HrDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Aggregate read endpoint for the HR / Compliance dashboard. Gated strictly
 * to HR + SUPER_ADMIN — OPERATIONS, TECHNICAL_EVALUATOR,
 * EXECUTIVE, APPLICANT, and INTERN cannot reach it. (The pre-existing
 * deeper compliance view at {@code /api/v1/compliance/overview} keeps its
 * own broader gate; this is the command-center dashboard, not that.)
 *
 * Privilege guarantees enforced by the service: the response carries no
 * decrypted PII (SSN / document numbers / DOB / A-Number stay encrypted on
 * the I-9 entity and are visible only on detail pages) and no audit-log
 * export controls (those stay on the SUPER_ADMIN admin pages).
 */
@RestController
@RequestMapping("/api/v1/hr")
@RequiredArgsConstructor
public class HrDashboardController {

    private final HrDashboardService hrDashboardService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public HrDashboardResponse dashboard(@AuthenticationPrincipal User caller) {
        return hrDashboardService.build(caller);
    }
}
