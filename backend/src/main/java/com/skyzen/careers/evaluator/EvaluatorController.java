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
    private final EvaluationWorkflowService workflowService;
    private final PendingEvaluationsService pendingService;

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

    // ── Phase 2 — monthly evaluation workflow ────────────────────────────

    @PostMapping("/evaluations")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluationWorkflowDtos.EvaluatorEvaluationDetail schedule(
            @RequestBody EvaluationWorkflowDtos.ScheduleRequest req,
            @AuthenticationPrincipal User caller) {
        return workflowService.schedule(req, caller);
    }

    @PostMapping("/evaluations/{id}/start")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluationWorkflowDtos.EvaluatorEvaluationDetail start(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        return workflowService.start(id, caller);
    }

    @PatchMapping("/evaluations/{id}/draft")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluationWorkflowDtos.EvaluatorEvaluationDetail saveDraft(
            @PathVariable UUID id,
            @RequestBody EvaluationWorkflowDtos.SaveDraftRequest req,
            @AuthenticationPrincipal User caller) {
        return workflowService.saveDraft(id, req, caller);
    }

    @PostMapping("/evaluations/{id}/publish")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluationWorkflowDtos.EvaluatorEvaluationDetail publish(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        return workflowService.publish(id, caller);
    }

    @PostMapping("/evaluations/{id}/amend")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluationWorkflowDtos.EvaluatorEvaluationDetail amend(
            @PathVariable UUID id,
            @RequestBody EvaluationWorkflowDtos.AmendRequest req,
            @AuthenticationPrincipal User caller) {
        return workflowService.amend(id, req, caller);
    }

    @GetMapping("/evaluations/{id}")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluationWorkflowDtos.EvaluatorEvaluationDetail getEvaluation(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        return workflowService.getEvaluatorDetail(id, caller);
    }

    @GetMapping("/pending-evaluations")
    @PreAuthorize("hasAnyRole('EVALUATOR', 'SUPER_ADMIN')")
    public EvaluationWorkflowDtos.PendingEvaluationsResponse pendingEvaluations(
            @AuthenticationPrincipal User caller) {
        return pendingService.list(caller);
    }
}
