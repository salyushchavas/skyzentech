package com.skyzen.careers.event.project.listener;

import com.skyzen.careers.entity.Project;
import com.skyzen.careers.event.project.ProjectMarkedPendingVivaEvent;
import com.skyzen.careers.event.project.ProjectReturnedForRevisionsEvent;
import com.skyzen.careers.event.project.ProjectTechApprovedEvent;
import com.skyzen.careers.notification.NotificationService;
import com.skyzen.careers.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Fans out emails for the two-role workflow transitions.
 *
 * <p>Listens on {@code AFTER_COMMIT} so a rollback in
 * {@code ProjectWorkflowService} never leaves the user with a stale email
 * about a transition that didn't actually land. Each handler re-reads the
 * project by id inside its own (REQUIRES_NEW) transaction via
 * {@link NotificationService}, so a listener failure can never poison the
 * upstream transaction.</p>
 *
 * <p>Best-effort end-to-end: any send failure is caught + logged; the
 * domain transition has already committed and downstream state is
 * unaffected.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EmailNotifierListener {

    private final ProjectRepository projectRepository;
    private final NotificationService notificationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onTechApproved(ProjectTechApprovedEvent event) {
        if (event == null) return;
        try {
            Project project = projectRepository.findByIdWithGraph(event.getProjectId())
                    .orElse(null);
            if (project == null) return;
            notificationService.sendProjectTechApproved(project);
        } catch (Exception e) {
            log.warn("PROJECT_TECH_APPROVED email failed (non-fatal) for {}: {}",
                    event.getProjectId(), e.getMessage());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReturnedForRevisions(ProjectReturnedForRevisionsEvent event) {
        if (event == null) return;
        try {
            Project project = projectRepository.findByIdWithGraph(event.getProjectId())
                    .orElse(null);
            if (project == null) return;
            notificationService.sendProjectReturnedForRevisions(project, event.getReason());
        } catch (Exception e) {
            log.warn("PROJECT_RETURNED_FOR_REVISIONS email failed (non-fatal) for {}: {}",
                    event.getProjectId(), e.getMessage());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMarkedPendingViva(ProjectMarkedPendingVivaEvent event) {
        if (event == null) return;
        try {
            Project project = projectRepository.findByIdWithGraph(event.getProjectId())
                    .orElse(null);
            if (project == null) return;
            notificationService.sendProjectPendingViva(project);
        } catch (Exception e) {
            log.warn("PROJECT_PENDING_VIVA email failed (non-fatal) for {}: {}",
                    event.getProjectId(), e.getMessage());
        }
    }
}
