package com.skyzen.careers.manager;

import com.skyzen.careers.dto.supervised.RejectTimesheetRequest;
import com.skyzen.careers.dto.supervised.TimesheetResponse;
import com.skyzen.careers.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final ManagerOnboardingService onboardingService;
    private final ManagerActiveInternsService activeInternsService;
    private final ManagerTimesheetService managerTimesheetService;
    private final ManagerTimesheetApprovalService managerTimesheetApprovalService;

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

    // ── Phase 2 — Onboarding Health ──────────────────────────────────────

    @GetMapping("/onboarding")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.OnboardingResponse onboarding(
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String workAuthType,
            @RequestParam(required = false) UUID ermOwner,
            @RequestParam(required = false) String needsAttention,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize,
            @AuthenticationPrincipal User caller) {
        return onboardingService.list(caller, stage, workAuthType, ermOwner,
                needsAttention, search, page, pageSize);
    }

    @GetMapping("/onboarding/summary")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.OnboardingSummary onboardingSummary(
            @AuthenticationPrincipal User caller) {
        return onboardingService.summary(caller);
    }

    @GetMapping("/onboarding/filters")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.OnboardingFilterOptions onboardingFilters() {
        return onboardingService.filterOptions();
    }

    // ── Phase 3A — Active Interns (read-only health view) ────────────────

    @GetMapping("/active-interns")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.ActiveInternResponse activeInterns(
            @RequestParam(required = false) String technology,
            @RequestParam(required = false) UUID trainerId,
            @RequestParam(required = false) UUID evaluatorId,
            @RequestParam(required = false) UUID ermOwner,
            @RequestParam(required = false) UUID managerId,
            @RequestParam(required = false) String health,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize,
            @AuthenticationPrincipal User caller) {
        return activeInternsService.list(caller, technology, trainerId,
                evaluatorId, ermOwner, managerId, health, search,
                page, pageSize);
    }

    @GetMapping("/active-interns/summary")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.ActiveInternSummary activeInternsSummary(
            @AuthenticationPrincipal User caller) {
        return activeInternsService.summary(caller);
    }

    @GetMapping("/active-interns/filters")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.ActiveInternFilterOptions activeInternsFilters() {
        return activeInternsService.filterOptions();
    }

    // ── Phase 3B — Timesheet Approvals (first Manager write action) ──────

    @GetMapping("/timesheets")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.TimesheetListResponse timesheets(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID managerId,
            @RequestParam(required = false) UUID ermOwner,
            @RequestParam(required = false) String technology,
            @RequestParam(required = false) String weekStart,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize,
            @AuthenticationPrincipal User caller) {
        return managerTimesheetService.list(caller, status, managerId, ermOwner,
                technology, weekStart, search, page, pageSize);
    }

    @GetMapping("/timesheets/filters")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public ManagerDtos.TimesheetFilterOptions timesheetsFilters() {
        return managerTimesheetService.filterOptions();
    }

    /** Ownership gate runs inside the service — caller must be the assigned
     *  manager OR SUPER_ADMIN. 403 otherwise; the existing TimesheetService
     *  state machine handles the actual SUBMITTED → APPROVED transition. */
    @PostMapping("/timesheets/{id}/approve")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public TimesheetResponse approveTimesheet(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        return managerTimesheetApprovalService.approve(id, caller);
    }

    @PostMapping("/timesheets/{id}/reject")
    @PreAuthorize("hasAnyRole('MANAGER', 'SUPER_ADMIN')")
    public TimesheetResponse rejectTimesheet(
            @PathVariable UUID id,
            @Valid @RequestBody RejectTimesheetRequest req,
            @AuthenticationPrincipal User caller) {
        return managerTimesheetApprovalService.reject(id, req, caller);
    }
}
