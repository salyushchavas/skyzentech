package com.skyzen.careers.controller;

import com.skyzen.careers.dto.supervised.LogTimesheetRequest;
import com.skyzen.careers.dto.supervised.RejectTimesheetRequest;
import com.skyzen.careers.dto.supervised.TimesheetListResponse;
import com.skyzen.careers.dto.supervised.TimesheetResponse;
import com.skyzen.careers.dto.supervised.UpdateTimesheetRequest;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.TimesheetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supervised")
@RequiredArgsConstructor
public class TimesheetController {

    private final TimesheetService timesheetService;

    @PostMapping("/my/timesheets")
    @PreAuthorize("hasAnyRole('APPLICANT', 'INTERN')")
    public ResponseEntity<TimesheetResponse> logHours(
            @Valid @RequestBody LogTimesheetRequest req,
            @AuthenticationPrincipal User caller) {
        TimesheetResponse created = timesheetService.logHours(req, caller);
        return ResponseEntity.created(URI.create("/api/v1/supervised/timesheets/" + created.getId()))
                .body(created);
    }

    @GetMapping("/my/timesheets")
    @PreAuthorize("hasAnyRole('APPLICANT', 'INTERN')")
    public TimesheetListResponse listMine(@AuthenticationPrincipal User caller) {
        return timesheetService.listMine(caller);
    }

    @PutMapping("/timesheets/{id}")
    @PreAuthorize("hasAnyRole('APPLICANT', 'INTERN')")
    public TimesheetResponse update(@PathVariable UUID id,
                                    @Valid @RequestBody UpdateTimesheetRequest req,
                                    @AuthenticationPrincipal User caller) {
        return timesheetService.update(id, req, caller);
    }

    @PostMapping("/timesheets/{id}/submit")
    @PreAuthorize("hasAnyRole('APPLICANT', 'INTERN')")
    public TimesheetResponse submit(@PathVariable UUID id,
                                    @AuthenticationPrincipal User caller) {
        return timesheetService.submit(id, caller);
    }

    @GetMapping("/interns/{candidateId}/timesheets")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'HR_COMPLIANCE', 'TECHNICAL_SUPERVISOR', 'REPORTING_MANAGER')")
    public TimesheetListResponse listForIntern(@PathVariable UUID candidateId) {
        return timesheetService.listForIntern(candidateId);
    }

    @PostMapping("/timesheets/{id}/approve")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'TECHNICAL_SUPERVISOR', 'REPORTING_MANAGER', 'SUPER_ADMIN')")
    public TimesheetResponse approve(@PathVariable UUID id,
                                     @AuthenticationPrincipal User caller) {
        return timesheetService.approve(id, caller);
    }

    @PostMapping("/timesheets/{id}/reject")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'TECHNICAL_SUPERVISOR', 'REPORTING_MANAGER', 'SUPER_ADMIN')")
    public TimesheetResponse reject(@PathVariable UUID id,
                                    @Valid @RequestBody RejectTimesheetRequest req,
                                    @AuthenticationPrincipal User caller) {
        return timesheetService.reject(id, req, caller);
    }
}
