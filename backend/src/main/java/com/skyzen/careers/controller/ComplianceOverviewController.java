package com.skyzen.careers.controller;

import com.skyzen.careers.dto.compliance.ComplianceOverviewResponse;
import com.skyzen.careers.service.ComplianceOverviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/compliance")
@RequiredArgsConstructor
public class ComplianceOverviewController {

    private final ComplianceOverviewService service;

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('OPERATIONS', 'HR', 'EXECUTIVE')")
    public ComplianceOverviewResponse getOverview() {
        return service.getOverview();
    }
}
