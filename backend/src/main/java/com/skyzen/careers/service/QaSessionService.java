package com.skyzen.careers.service;

import com.skyzen.careers.dto.qa.QaSessionResponse;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.QaSession;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ProjectStatus;
import com.skyzen.careers.enums.QaSessionStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.ProjectRepository;
import com.skyzen.careers.repository.QaSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Q&amp;A (viva) session surface. The session row owns the scheduling /
 * conducting metadata; the project's lifecycle transitions are owned by
 * {@link ProjectWorkflowService} — this service DELEGATES on schedule, sign-off
 * and return so there's a single source of truth for status changes.
 *
 * <h2>Scoping</h2>
 * Read + write actions on a session require either the engagement's
 * {@code reportingManager} or {@code SUPER_ADMIN}. The intern (the project's
 * candidate user) can read their own session. The technical supervisor on
 * the same engagement can also read.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QaSessionService {

    private final QaSessionRepository qaSessionRepository;
    private final ProjectRepository projectRepository;
    private final ProjectWorkflowService projectWorkflowService;

    @Transactional
    public QaSession schedule(UUID projectId, Instant scheduledAt, String meetingLink, User caller) {
        if (scheduledAt == null) {
            throw new BadRequestException("scheduledAt is required.");
        }
        Project project = projectRepository.findByIdWithGraph(projectId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + projectId));
        ensureRmOrSuperAdmin(project, caller);
        ProjectStatus current = project.getStatus();
        if (current != ProjectStatus.TECH_APPROVED && current != ProjectStatus.PENDING_VIVA) {
            throw new BadRequestException(
                    "Q&A can only be scheduled on a TECH_APPROVED or PENDING_VIVA project (current: "
                            + current + ")");
        }

        QaSession session = QaSession.builder()
                .project(project)
                .scheduledAt(scheduledAt)
                .meetingLink(trimToNull(meetingLink))
                .status(QaSessionStatus.SCHEDULED)
                .scheduledBy(caller)
                .build();
        session = qaSessionRepository.save(session);

        // Flip the project to PENDING_VIVA via the workflow service (idempotent
        // when already pending). The workflow service owns the audit + event.
        if (current == ProjectStatus.TECH_APPROVED) {
            projectWorkflowService.markPendingViva(project.getId(), caller, scheduledAt);
        }
        return qaSessionRepository.findByIdWithGraph(session.getId())
                .orElseThrow(() -> new IllegalStateException("Just-saved session vanished"));
    }

    @Transactional
    public QaSession updateConducted(UUID sessionId, String questionsAsked,
                                     String internResponses, User caller) {
        QaSession session = load(sessionId);
        ensureRmOrSuperAdmin(session.getProject(), caller);
        if (session.getStatus() != QaSessionStatus.SCHEDULED
                && session.getStatus() != QaSessionStatus.CONDUCTED) {
            throw new BadRequestException(
                    "Conducted notes can only be captured on a SCHEDULED or CONDUCTED session (current: "
                            + session.getStatus() + ")");
        }
        session.setQuestionsAsked(trimToNull(questionsAsked));
        session.setInternResponses(trimToNull(internResponses));
        if (session.getStatus() == QaSessionStatus.SCHEDULED
                && (session.getQuestionsAsked() != null || session.getInternResponses() != null)) {
            session.setStatus(QaSessionStatus.CONDUCTED);
            session.setConductedBy(caller);
        }
        qaSessionRepository.save(session);
        return session;
    }

    @Transactional
    public QaSession signOff(UUID sessionId, Integer marks, String remarks, User caller) {
        QaSession session = load(sessionId);
        ensureRmOrSuperAdmin(session.getProject(), caller);
        if (session.getStatus() == QaSessionStatus.COMPLETED) return session;
        if (session.getStatus() == QaSessionStatus.RETURNED) {
            throw new BadRequestException("Session has already been returned — cannot sign off.");
        }
        if (isBlank(session.getQuestionsAsked()) || isBlank(session.getInternResponses())) {
            throw new BadRequestException(
                    "Capture questions + intern responses before signing off.");
        }
        if (marks != null && (marks < 0 || marks > 10)) {
            throw new BadRequestException("marks must be between 0 and 10.");
        }

        // Workflow service owns the project status flip + audit + event.
        projectWorkflowService.completeAfterViva(session.getProject().getId(), caller);

        session.setMarks(marks);
        session.setRemarks(trimToNull(remarks));
        session.setStatus(QaSessionStatus.COMPLETED);
        session.setConductedBy(caller);
        session.setCompletedAt(Instant.now());
        qaSessionRepository.save(session);
        return session;
    }

    @Transactional
    public QaSession returnForRevisions(UUID sessionId, String reason, User caller) {
        QaSession session = load(sessionId);
        ensureRmOrSuperAdmin(session.getProject(), caller);
        if (session.getStatus() == QaSessionStatus.COMPLETED) {
            throw new BadRequestException("Session is already signed off — cannot return.");
        }
        if (session.getStatus() == QaSessionStatus.RETURNED) return session;
        if (reason == null || reason.trim().length() < 10) {
            throw new BadRequestException("A reason of at least 10 characters is required.");
        }

        projectWorkflowService.returnForRevisions(session.getProject().getId(), caller, reason);

        session.setStatus(QaSessionStatus.RETURNED);
        session.setConductedBy(caller);
        session.setReturnReason(reason.trim());
        session.setReturnedAt(Instant.now());
        qaSessionRepository.save(session);
        return session;
    }

    @Transactional(readOnly = true)
    public QaSession get(UUID sessionId, User caller) {
        QaSession session = load(sessionId);
        ensureCanRead(session.getProject(), caller);
        return session;
    }

    @Transactional(readOnly = true)
    public List<QaSession> listByProject(UUID projectId, User caller) {
        Project project = projectRepository.findByIdWithGraph(projectId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project not found: " + projectId));
        ensureCanRead(project, caller);
        return qaSessionRepository.findByProjectIdWithGraph(projectId);
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    public QaSessionResponse toResponse(QaSession s) {
        Project p = s.getProject();
        var intern = p.getIntern();
        var internUser = intern != null ? intern.getUser() : null;
        return new QaSessionResponse(
                s.getId(),
                p.getId(),
                p.getTitle(),
                internUser != null ? internUser.getId() : null,
                internUser != null ? internUser.getFullName() : null,
                s.getScheduledAt(),
                s.getMeetingLink(),
                s.getStatus(),
                s.getQuestionsAsked(),
                s.getInternResponses(),
                s.getMarks(),
                s.getRemarks(),
                s.getScheduledBy() != null ? s.getScheduledBy().getId() : null,
                s.getConductedBy() != null ? s.getConductedBy().getId() : null,
                s.getCompletedAt(),
                s.getReturnedAt(),
                s.getReturnReason(),
                s.getCreatedAt(),
                s.getUpdatedAt()
        );
    }

    // ── Internals ───────────────────────────────────────────────────────────

    private QaSession load(UUID sessionId) {
        return qaSessionRepository.findByIdWithGraph(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Q&A session not found: " + sessionId));
    }

    private static void ensureRmOrSuperAdmin(Project project, User caller) {
        if (caller == null) throw new ForbiddenException("Authentication required.");
        if (isSuperAdmin(caller)) return;
        Engagement eng = project.getEngagement();
        User rm = eng != null ? eng.getReportingManager() : null;
        if (rm == null || !rm.getId().equals(caller.getId())) {
            throw new ForbiddenException(
                    "Only the engagement's Reporting Manager (or SUPER_ADMIN) may act on this Q&A.");
        }
    }

    private static void ensureCanRead(Project project, User caller) {
        if (caller == null) throw new ForbiddenException("Authentication required.");
        if (isSuperAdmin(caller)) return;
        Engagement eng = project.getEngagement();
        User rm = eng != null ? eng.getReportingManager() : null;
        User supervisor = eng != null ? eng.getSupervisor() : null;
        var intern = project.getIntern();
        User internUser = intern != null ? intern.getUser() : null;
        UUID callerId = caller.getId();
        boolean isRm = rm != null && rm.getId().equals(callerId);
        boolean isSupervisor = supervisor != null && supervisor.getId().equals(callerId);
        boolean isIntern = internUser != null && internUser.getId().equals(callerId);
        if (!isRm && !isSupervisor && !isIntern) {
            throw new ForbiddenException("Not authorised to view this Q&A session.");
        }
    }

    private static boolean isSuperAdmin(User u) {
        return u.getRoles() != null && u.getRoles().contains(UserRole.SUPER_ADMIN);
    }

    private static String trimToNull(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
