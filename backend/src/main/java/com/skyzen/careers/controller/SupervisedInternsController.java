package com.skyzen.careers.controller;

import com.skyzen.careers.dto.supervised.InternSummaryResponse;
import com.skyzen.careers.service.SupervisedInternsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supervised")
@RequiredArgsConstructor
public class SupervisedInternsController {

    private final SupervisedInternsService supervisedInternsService;

    @GetMapping("/interns")
    @PreAuthorize("hasAnyRole('ERM', 'TECHNICAL_EVALUATOR', 'HR_COMPLIANCE', 'ADMIN')")
    public List<InternSummaryResponse> listInterns(
            @RequestParam(required = false) UUID entityId,
            @RequestParam(required = false) String search) {
        return supervisedInternsService.listHiredInterns(entityId, search);
    }
}
