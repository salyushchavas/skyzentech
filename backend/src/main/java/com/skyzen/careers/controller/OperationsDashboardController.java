package com.skyzen.careers.controller;

import com.skyzen.careers.dto.operations.OperationsDashboardResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.OperationsDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Aggregate read endpoint for the Operations dashboard. SUPER_ADMIN is allowed
 * alongside OPERATIONS so the owner can preview the operational view without
 * being assigned the OPERATIONS role explicitly — matches the pattern in
 * AdminInsightsController where EXECUTIVE rides along with SUPER_ADMIN.
 *
 * Privilege guarantee: this controller's service deliberately depends on
 * neither compliance repositories (I-9 / I-983 / E-Verify) nor admin services
 * (user / entity / audit-log mgmt). The DTO carries no PII beyond name +
 * position and never surfaces work-auth, document, or system-config state.
 */
@RestController
@RequestMapping("/api/v1/operations")
@RequiredArgsConstructor
public class OperationsDashboardController {

    private final OperationsDashboardService operationsDashboardService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public OperationsDashboardResponse dashboard(@AuthenticationPrincipal User caller) {
        return operationsDashboardService.build(caller);
    }
}
