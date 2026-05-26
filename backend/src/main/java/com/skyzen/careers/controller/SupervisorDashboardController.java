package com.skyzen.careers.controller;

import com.skyzen.careers.dto.supervisor.SupervisorDashboardResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.SupervisorDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Aggregate read endpoint for the Technical Supervisor dashboard.
 *
 * <h2>Roles</h2>
 * Gated to {@code TECHNICAL_SUPERVISOR} and {@code SUPER_ADMIN}. Operations,
 * HR_COMPLIANCE, EXECUTIVE, APPLICANT, INTERN are all 403.
 *
 * <h2>Scope</h2>
 * The service restricts a TECHNICAL_SUPERVISOR's view to ACTIVE engagements
 * where they are the {@code Engagement.supervisor}. SUPER_ADMIN bypasses
 * the scope and sees every active engagement.
 *
 * <h2>Privilege boundary</h2>
 * The service depends on no compliance repositories and surfaces no
 * compliance PII; no audit-log export controls are exposed here.
 */
@RestController
@RequestMapping("/api/v1/supervisor")
@RequiredArgsConstructor
public class SupervisorDashboardController {

    private final SupervisorDashboardService supervisorDashboardService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('TECHNICAL_SUPERVISOR', 'SUPER_ADMIN')")
    public SupervisorDashboardResponse dashboard(@AuthenticationPrincipal User caller) {
        return supervisorDashboardService.build(caller);
    }
}
