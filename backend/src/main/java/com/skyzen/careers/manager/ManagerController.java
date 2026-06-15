package com.skyzen.careers.manager;

import com.skyzen.careers.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Manager Phase 1 — read-only HTTP surface for the Executive Overview
 *  and Applicant Pipeline. RBAC: MANAGER + SUPER_ADMIN (enforced at
 *  endpoint level, not relying on frontend gating). */
@RestController
@RequestMapping("/api/v1/manager")
@RequiredArgsConstructor
@Slf4j
public class ManagerController {

    private final ManagerDashboardService dashboardService;
    private final ManagerPipelineService pipelineService;

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.OverviewResponse overview(
            @AuthenticationPrincipal User caller) {
        return dashboardService.getOverview(caller);
    }

    @GetMapping("/pipeline")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.PipelineResponse pipeline(
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String technology,
            @RequestParam(required = false) UUID ermOwner,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize,
            @AuthenticationPrincipal User caller) {
        return pipelineService.list(caller, stage, technology, ermOwner, search, page, pageSize);
    }

    @GetMapping("/pipeline/filters")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.FilterOptions pipelineFilters() {
        return pipelineService.filterOptions();
    }
}
