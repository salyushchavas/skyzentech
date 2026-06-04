package com.skyzen.careers.controller;

import com.skyzen.careers.dto.supervised.RejectTimesheetRequest;
import com.skyzen.careers.dto.supervised.ReturnTimesheetRequest;
import com.skyzen.careers.dto.supervised.TimesheetResponse;
import com.skyzen.careers.dto.supervised.TimesheetWeekResponse;
import com.skyzen.careers.dto.supervised.UpdateTimesheetDayRequest;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.TimesheetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Day-by-day timesheet endpoints — additive surface over the existing
 * supervised flow. The legacy /api/v1/supervised/timesheets/* endpoints
 * stay live for older callers; pages on the new RM workflow call here.
 */
@RestController
@RequestMapping("/api/v1/timesheets")
@RequiredArgsConstructor
public class TimesheetWeekController {

    private final TimesheetService timesheetService;

    @GetMapping("/week")
    @PreAuthorize("hasAnyRole('INTERN', 'SUPER_ADMIN')")
    public TimesheetWeekResponse getWeek(
            @RequestParam("weekStart") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate weekStart,
            @AuthenticationPrincipal User caller) {
        return timesheetService.getOrCreateWeek(weekStart, caller);
    }

    @PatchMapping("/{id}/days/{day}")
    @PreAuthorize("hasAnyRole('INTERN', 'SUPER_ADMIN')")
    public TimesheetWeekResponse patchDay(
            @PathVariable UUID id,
            @PathVariable("day") DayOfWeek day,
            @Valid @RequestBody UpdateTimesheetDayRequest req,
            @AuthenticationPrincipal User caller) {
        return timesheetService.patchDay(id, day, req.hours(), req.notes(), caller);
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAnyRole('INTERN', 'SUPER_ADMIN')")
    public TimesheetResponse submit(@PathVariable UUID id,
                                    @AuthenticationPrincipal User caller) {
        return timesheetService.submit(id, caller);
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public TimesheetWeekResponse get(@PathVariable UUID id,
                                     @AuthenticationPrincipal User caller) {
        return timesheetService.getWeek(id, caller);
    }

    @GetMapping("/pending-approval")
    @PreAuthorize("hasAnyRole('REPORTING_MANAGER', 'SUPER_ADMIN')")
    public List<TimesheetWeekResponse> pendingApproval(
            @AuthenticationPrincipal User caller) {
        return timesheetService.listPendingApproval(caller);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('REPORTING_MANAGER', 'SUPER_ADMIN')")
    public TimesheetResponse approve(@PathVariable UUID id,
                                     @AuthenticationPrincipal User caller) {
        return timesheetService.approve(id, caller);
    }

    /**
     * RM-facing alias for the existing reject endpoint. Reuses
     * {@link TimesheetService#reject} so the underlying transition stays in
     * one place; the new "return" terminology is surfaced for UI clarity.
     */
    @PostMapping("/{id}/return")
    @PreAuthorize("hasAnyRole('REPORTING_MANAGER', 'SUPER_ADMIN')")
    public TimesheetResponse returnForCorrection(
            @PathVariable UUID id,
            @Valid @RequestBody ReturnTimesheetRequest req,
            @AuthenticationPrincipal User caller) {
        RejectTimesheetRequest mapped = new RejectTimesheetRequest();
        mapped.setReason(req.reason());
        return timesheetService.reject(id, mapped, caller);
    }
}
