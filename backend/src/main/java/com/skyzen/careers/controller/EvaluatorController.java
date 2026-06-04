package com.skyzen.careers.controller;

import com.skyzen.careers.dto.supervised.EvaluatorAssignmentResponse;
import com.skyzen.careers.dto.supervised.EvaluatorDashboardResponse;
import com.skyzen.careers.dto.supervised.EvaluatorInternResponse;
import com.skyzen.careers.dto.supervised.EvaluatorSessionResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.WorkAssignmentStatus;
import com.skyzen.careers.service.EvaluatorListsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Evaluator-scoped read endpoints — interns, sessions, assignments, and the
 * hub dashboard. All scoped to the authenticated evaluator (we never accept a
 * client-supplied userId). ADMIN gets the same view of their own (empty) data
 * unless they're also an evaluator — by design, since ADMIN is an oversight
 * role and the lists are filtered by {@code assignedEvaluator = caller}.
 */
@RestController
@RequestMapping("/api/v1/supervised/evaluator")
@RequiredArgsConstructor
public class EvaluatorController {

    private final EvaluatorListsService evaluatorListsService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('ERM', 'TRAINER')")
    public EvaluatorDashboardResponse dashboard(@AuthenticationPrincipal User caller) {
        return evaluatorListsService.dashboard(caller);
    }

    @GetMapping("/interns")
    @PreAuthorize("hasAnyRole('ERM', 'TRAINER')")
    public List<EvaluatorInternResponse> interns(@AuthenticationPrincipal User caller) {
        return evaluatorListsService.listInterns(caller);
    }

    @GetMapping("/sessions")
    @PreAuthorize("hasAnyRole('ERM', 'TRAINER')")
    public List<EvaluatorSessionResponse> sessions(@AuthenticationPrincipal User caller) {
        return evaluatorListsService.listSessions(caller);
    }

    @GetMapping("/assignments")
    @PreAuthorize("hasAnyRole('ERM', 'TRAINER')")
    public List<EvaluatorAssignmentResponse> assignments(
            @AuthenticationPrincipal User caller,
            @RequestParam(required = false) WorkAssignmentStatus status) {
        return evaluatorListsService.listAssignments(caller, status);
    }
}
