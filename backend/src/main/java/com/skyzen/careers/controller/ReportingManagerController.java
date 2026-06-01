package com.skyzen.careers.controller;

import com.skyzen.careers.dto.rm.ReportingManagerDashboardResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.ReportingManagerDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reporting-manager")
@RequiredArgsConstructor
public class ReportingManagerController {

    private final ReportingManagerDashboardService dashboardService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('REPORTING_MANAGER', 'SUPER_ADMIN')")
    public ReportingManagerDashboardResponse dashboard(
            @AuthenticationPrincipal User caller) {
        return dashboardService.build(caller);
    }
}
