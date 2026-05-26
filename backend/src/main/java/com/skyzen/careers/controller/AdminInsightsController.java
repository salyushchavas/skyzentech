package com.skyzen.careers.controller;

import com.skyzen.careers.dto.admin.AdminOverviewResponse;
import com.skyzen.careers.dto.admin.PagedAuditLogResponse;
import com.skyzen.careers.service.AdminAuditLogService;
import com.skyzen.careers.service.AdminOverviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * Read-only ADMIN insights: platform overview + paged audit log viewer.
 * No PageImpl on the wire — see {@link PagedAuditLogResponse}.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminInsightsController {

    private final AdminOverviewService adminOverviewService;
    private final AdminAuditLogService adminAuditLogService;

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'EXECUTIVE')")
    public AdminOverviewResponse overview() {
        return adminOverviewService.build();
    }

    @GetMapping("/audit-log")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'EXECUTIVE')")
    public PagedAuditLogResponse auditLog(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String actorSearch,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to) {
        return adminAuditLogService.search(page, size, action, actorSearch, from, to);
    }

    @GetMapping("/audit-log/actions")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'EXECUTIVE')")
    public List<String> auditLogActions() {
        return adminAuditLogService.distinctActions();
    }
}
