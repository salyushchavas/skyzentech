package com.skyzen.careers.listener;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.event.project.ProjectCompletedEvent;
import com.skyzen.careers.intern.InternEvaluationService;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Phase 6 — when Phase 5's ProjectCompletedEvent fires, auto-draft a
 * POST_PROJECT evaluation row for the assigned Evaluator. Best-effort:
 * a failure logs but never rolls back the project completion.
 *
 * <p>If the lifecycle has no evaluator assigned, the draft is skipped
 * with a warning — Phase 7 will fan that into a SentNotification for ERM
 * ("Assign evaluator to {intern}").</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PostProjectEvaluationListener {

    private final ProjectRepository projectRepository;
    private final InternLifecycleRepository lifecycleRepository;
    private final InternEvaluationService evaluationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onProjectCompleted(ProjectCompletedEvent event) {
        try {
            Project project = projectRepository.findById(event.getProjectId()).orElse(null);
            if (project == null) {
                log.warn("[PostProjectEval] project {} not found post-commit; skipping",
                        event.getProjectId());
                return;
            }
            // Resolve the intern user id via the project's candidate → user chain.
            java.util.UUID internUserId = project.getIntern() != null
                    && project.getIntern().getUser() != null
                    ? project.getIntern().getUser().getId() : null;
            if (internUserId == null) {
                log.warn("[PostProjectEval] project {} has no resolvable intern user; skipping",
                        event.getProjectId());
                return;
            }
            InternLifecycle lc = lifecycleRepository.findByUserId(internUserId).orElse(null);
            if (lc == null) {
                log.warn("[PostProjectEval] no InternLifecycle for user {}; skipping",
                        internUserId);
                return;
            }
            if (lc.getEvaluatorId() == null) {
                log.warn("[PostProjectEval] lifecycle {} has no evaluator assigned — "
                        + "ERM must assign before post-project draft can mint", lc.getId());
                return;
            }
            evaluationService.autoDraftPostProject(lc, project.getId(),
                    event.getClosedByUserId());
            log.info("[PostProjectEval] auto-drafted POST_PROJECT eval for project={} intern={}",
                    project.getId(), internUserId);
        } catch (Exception e) {
            log.warn("[PostProjectEval] auto-draft failed (non-fatal): {}", e.getMessage());
        }
    }
}
