package com.skyzen.careers.evaluator;

import com.skyzen.careers.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Evaluator Phase 1 — read-only HTTP surface. */
@RestController
@RequestMapping("/api/v1/evaluator")
@RequiredArgsConstructor
@Slf4j
public class EvaluatorController {

    private final EvaluatorDashboardService dashboardService;
    private final EvaluatorEvalueesService evalueesService;
    private final EvaluatorRightPanelService rightPanelService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluatorDtos.DashboardResponse dashboard(
            @AuthenticationPrincipal User caller) {
        return dashboardService.getDashboard(caller);
    }

    @GetMapping("/active-evaluees")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluatorDtos.ActiveEvalueesPage activeEvaluees(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String workAuthType,
            @RequestParam(required = false) String needsAttention,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize,
            @AuthenticationPrincipal User caller) {
        return evalueesService.list(
                caller, search, workAuthType, needsAttention, page, pageSize);
    }

    @GetMapping("/evaluees/{lifecycleId}")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluatorDtos.EvalueeDetail evalueeDetail(
            @PathVariable UUID lifecycleId,
            @AuthenticationPrincipal User caller) {
        return evalueesService.getDetail(lifecycleId, caller);
    }

    @GetMapping("/right-panel")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluatorDtos.RightPanelResponse rightPanel(
            @RequestParam(required = false) UUID lifecycleId,
            @AuthenticationPrincipal User caller) {
        return rightPanelService.get(lifecycleId, caller);
    }
}
