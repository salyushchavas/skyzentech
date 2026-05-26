package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.report.CreateWeeklyReportRequest;
import com.skyzen.careers.dto.report.ReviewWeeklyReportRequest;
import com.skyzen.careers.dto.report.UpdateWeeklyReportRequest;
import com.skyzen.careers.dto.report.WeeklyReportResponse;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.entity.WeeklyReport;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.enums.WeeklyReportStatus;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.WeeklyReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Weekly narrative reports — second piece of the Phase-2 weekly cycle.
 *
 * <h2>Active-engagement gate</h2>
 * Mirrors {@link WeeklyMaterialService#requireActiveEngagement} verbatim: a
 * caller must have a {@link Candidate} row with an Engagement in status
 * {@link EngagementStatus#ACTIVE}. Pre-hire / pending / completed interns
 * cannot create or edit reports.
 *
 * <h2>APPROVED-lock guard</h2>
 * Once {@code status == APPROVED} the report is frozen. PUT returns 409,
 * RETURN / APPROVE are silent idempotent no-ops (so a supervisor
 * double-click on Approve doesn't 400).
 *
 * <h2>Supervisor ownership</h2>
 * The TECHNICAL_SUPERVISOR can only review reports for interns whose active
 * engagement they own ({@code engagement.supervisor.id == actor.id}).
 * SUPER_ADMIN bypasses the ownership check.
 *
 * <h2>Audit actions</h2>
 * <ul>
 *   <li>REPORT_SUBMITTED — DRAFT or RETURNED → SUBMITTED (intern)</li>
 *   <li>REPORT_RETURNED — supervisor sent back with notes</li>
 *   <li>REPORT_APPROVED — supervisor approved (terminal)</li>
 * </ul>
 * No CREATE / UPDATE audit — same scope rule as WeeklyMaterials. The lifecycle
 * transitions are the events worth keeping.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WeeklyReportService {

    private final WeeklyReportRepository reportRepository;
    private final CandidateRepository candidateRepository;
    private final EngagementRepository engagementRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    // ── Intern commands ─────────────────────────────────────────────────────

    @Transactional
    public WeeklyReportResponse create(CreateWeeklyReportRequest req, User actor) {
        Engagement engagement = requireActiveEngagement(actor);
        Candidate intern = engagement.getCandidate();

        try {
            WeeklyReport report = WeeklyReport.builder()
                    .intern(intern)
                    .weekStart(req.getWeekStart())
                    .completedWork(req.getCompletedWork())
                    .blockers(req.getBlockers())
                    .learningOutcomes(req.getLearningOutcomes())
                    .nextPlan(req.getNextPlan())
                    .status(WeeklyReportStatus.DRAFT)
                    .build();
            report = reportRepository.save(report);
            // Re-fetch with graph so the response carries intern.user / reviewer
            // without lazy-loading after the transaction closes.
            WeeklyReport saved = reportRepository.findByIdWithGraph(report.getId())
                    .orElse(report);
            return toResponse(saved);
        } catch (DataIntegrityViolationException dup) {
            // The unique constraint on (intern_id, week_start) tripped — the
            // intern already has a row for this week. Surface as 409 with a
            // helpful pointer to PUT the existing row.
            throw new ConflictException(
                    "A weekly report already exists for that week. Open the existing draft to edit.");
        }
    }

    @Transactional
    public WeeklyReportResponse update(UUID reportId,
                                       UpdateWeeklyReportRequest req,
                                       User actor) {
        WeeklyReport report = reportRepository.findByIdWithGraph(reportId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Weekly report not found: " + reportId));
        ensureInternOwner(report, actor);

        if (report.getStatus() == WeeklyReportStatus.APPROVED) {
            // Hard lock — supervisor's signed off, intern can't edit any more.
            throw new ConflictException(
                    "This report has been approved and is locked. Start a new week's report.");
        }

        if (req.getWeekStart() != null) report.setWeekStart(req.getWeekStart());
        if (req.getCompletedWork() != null) report.setCompletedWork(req.getCompletedWork());
        if (req.getBlockers() != null) report.setBlockers(req.getBlockers());
        if (req.getLearningOutcomes() != null) report.setLearningOutcomes(req.getLearningOutcomes());
        if (req.getNextPlan() != null) report.setNextPlan(req.getNextPlan());

        boolean submitting = Boolean.TRUE.equals(req.getSubmit())
                && (report.getStatus() == WeeklyReportStatus.DRAFT
                    || report.getStatus() == WeeklyReportStatus.RETURNED);

        if (submitting) {
            report.setStatus(WeeklyReportStatus.SUBMITTED);
            report.setSubmittedAt(Instant.now());
        }

        WeeklyReport saved;
        try {
            saved = reportRepository.save(report);
        } catch (DataIntegrityViolationException dup) {
            // Edge case: intern changed weekStart to one that collides with
            // another of their own existing rows. Treat as user error.
            throw new ConflictException(
                    "Another report already exists for that week.");
        }

        if (submitting) {
            writeAudit(saved.getId(), "REPORT_SUBMITTED", actor.getId(),
                    Map.of("weekStart", saved.getWeekStart().toString(),
                           "internCandidateId", saved.getIntern().getId()));
        }

        WeeklyReport refreshed = reportRepository.findByIdWithGraph(saved.getId())
                .orElse(saved);
        return toResponse(refreshed);
    }

    @Transactional(readOnly = true)
    public List<WeeklyReportResponse> listForMe(User actor) {
        // The intern self-view doesn't require an ACTIVE engagement — once
        // they've ever filed reports, they should still see the history (e.g.
        // engagement COMPLETED). We resolve the candidate by user id and
        // return whatever rows exist.
        Candidate candidate = candidateRepository.findByUserId(actor.getId())
                .orElseThrow(() -> new ForbiddenException(
                        "Weekly reports are available to interns only."));
        return reportRepository.findByInternIdWithGraph(candidate.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // ── Supervisor commands ─────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<WeeklyReportResponse> listForCandidate(UUID candidateId, User actor) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + candidateId));
        ensureSupervisorCanReview(candidate, actor);
        return reportRepository.findByInternIdWithGraph(candidate.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public WeeklyReportResponse returnForCorrection(UUID reportId,
                                                    ReviewWeeklyReportRequest req,
                                                    User actor) {
        WeeklyReport report = reportRepository.findByIdWithGraph(reportId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Weekly report not found: " + reportId));
        ensureSupervisorCanReview(report.getIntern(), actor);

        if (report.getStatus() == WeeklyReportStatus.APPROVED) {
            // Already locked — idempotent no-op so a stale supervisor click
            // doesn't 400.
            return toResponse(report);
        }
        if (report.getStatus() == WeeklyReportStatus.DRAFT) {
            throw new BadRequestException(
                    "Can't return a DRAFT report — it hasn't been submitted yet.");
        }
        if (req == null || req.getReviewNotes() == null || req.getReviewNotes().isBlank()) {
            throw new BadRequestException(
                    "Review notes are required when returning a report for correction.");
        }

        report.setStatus(WeeklyReportStatus.RETURNED);
        report.setReviewedBy(actor);
        report.setReviewNotes(req.getReviewNotes().trim());
        report.setReviewedAt(Instant.now());
        WeeklyReport saved = reportRepository.save(report);

        writeAudit(saved.getId(), "REPORT_RETURNED", actor.getId(),
                Map.of("weekStart", saved.getWeekStart().toString(),
                       "internCandidateId", saved.getIntern().getId()));

        WeeklyReport refreshed = reportRepository.findByIdWithGraph(saved.getId())
                .orElse(saved);
        return toResponse(refreshed);
    }

    @Transactional
    public WeeklyReportResponse approve(UUID reportId,
                                        ReviewWeeklyReportRequest req,
                                        User actor) {
        WeeklyReport report = reportRepository.findByIdWithGraph(reportId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Weekly report not found: " + reportId));
        ensureSupervisorCanReview(report.getIntern(), actor);

        if (report.getStatus() == WeeklyReportStatus.APPROVED) {
            // Already locked — idempotent no-op.
            return toResponse(report);
        }
        if (report.getStatus() == WeeklyReportStatus.DRAFT) {
            throw new BadRequestException(
                    "Can't approve a DRAFT report — it hasn't been submitted yet.");
        }

        report.setStatus(WeeklyReportStatus.APPROVED);
        report.setReviewedBy(actor);
        if (req != null && req.getReviewNotes() != null && !req.getReviewNotes().isBlank()) {
            report.setReviewNotes(req.getReviewNotes().trim());
        }
        report.setReviewedAt(Instant.now());
        WeeklyReport saved = reportRepository.save(report);

        writeAudit(saved.getId(), "REPORT_APPROVED", actor.getId(),
                Map.of("weekStart", saved.getWeekStart().toString(),
                       "internCandidateId", saved.getIntern().getId()));

        WeeklyReport refreshed = reportRepository.findByIdWithGraph(saved.getId())
                .orElse(saved);
        return toResponse(refreshed);
    }

    // ── Gate helpers ────────────────────────────────────────────────────────

    /**
     * Active-engagement gate — same shape as {@link WeeklyMaterialService}.
     * Returns the engagement so callers can read its candidate / id.
     */
    private Engagement requireActiveEngagement(User candidateUser) {
        Candidate candidate = candidateRepository.findByUserId(candidateUser.getId())
                .orElseThrow(() -> new ForbiddenException(
                        "Weekly reports are available to active interns only."));
        List<Engagement> active = engagementRepository
                .findByCandidateIdAndStatus(candidate.getId(), EngagementStatus.ACTIVE);
        if (active.isEmpty()) {
            throw new ForbiddenException(
                    "Weekly reports are available to active interns only.");
        }
        return active.stream()
                .max(Comparator.comparing(Engagement::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(active.get(0));
    }

    /**
     * Intern-owner gate: the report belongs to the caller's Candidate row.
     * No SUPER_ADMIN bypass here — admins don't author reports on someone
     * else's behalf; they use the supervisor review surface instead.
     */
    private void ensureInternOwner(WeeklyReport report, User actor) {
        Candidate candidate = candidateRepository.findByUserId(actor.getId())
                .orElseThrow(() -> new ForbiddenException(
                        "Weekly reports are available to interns only."));
        if (report.getIntern() == null
                || !report.getIntern().getId().equals(candidate.getId())) {
            // Don't leak existence — use the same 404-shape as if the row
            // didn't exist.
            throw new ResourceNotFoundException(
                    "Weekly report not found: " + report.getId());
        }
    }

    /**
     * Supervisor review gate: SUPER_ADMIN bypasses; otherwise the actor must
     * be the supervisor on this candidate's most-recent in-funnel engagement.
     */
    private void ensureSupervisorCanReview(Candidate candidate, User actor) {
        if (actor == null) {
            throw new ForbiddenException("Authentication required.");
        }
        if (actor.getRoles() != null && actor.getRoles().contains(UserRole.SUPER_ADMIN)) {
            return;
        }
        // Look at the candidate's engagements — any ACTIVE one whose
        // supervisor matches the actor counts. We accept any-status
        // engagement here so a supervisor can review reports that were
        // filed during ACTIVE even if the engagement has since COMPLETED.
        List<Engagement> engagements = engagementRepository.findByCandidateId(candidate.getId());
        boolean owns = engagements.stream()
                .anyMatch(e -> e.getSupervisor() != null
                        && e.getSupervisor().getId().equals(actor.getId()));
        if (!owns) {
            throw new ForbiddenException(
                    "Only this intern's supervisor (or SUPER_ADMIN) may review their reports.");
        }
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private WeeklyReportResponse toResponse(WeeklyReport r) {
        Candidate intern = r.getIntern();
        User internUser = intern != null ? intern.getUser() : null;
        User reviewer = r.getReviewedBy();
        return WeeklyReportResponse.builder()
                .id(r.getId())
                .internCandidateId(intern != null ? intern.getId() : null)
                .internName(internUser != null ? internUser.getFullName() : null)
                .weekStart(r.getWeekStart())
                .completedWork(r.getCompletedWork())
                .blockers(r.getBlockers())
                .learningOutcomes(r.getLearningOutcomes())
                .nextPlan(r.getNextPlan())
                .status(r.getStatus())
                .submittedAt(r.getSubmittedAt())
                .reviewedById(reviewer != null ? reviewer.getId() : null)
                .reviewedByName(reviewer != null ? reviewer.getFullName() : null)
                .reviewNotes(r.getReviewNotes())
                .reviewedAt(r.getReviewedAt())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .build();
    }

    // ── Audit ───────────────────────────────────────────────────────────────

    private void writeAudit(UUID reportId, String action, UUID userId,
                            Map<String, Object> snapshot) {
        Map<String, Object> after = snapshot != null
                ? new LinkedHashMap<>(snapshot) : new LinkedHashMap<>();
        AuditLog entry = AuditLog.builder()
                .entityType("WeeklyReport")
                .entityId(reportId)
                .action(action)
                .userId(userId)
                .afterJson(serializeJson(after))
                .build();
        auditLogRepository.save(entry);
    }

    private String serializeJson(Map<String, Object> snapshot) {
        if (snapshot == null) return null;
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize report audit snapshot: {}", e.getMessage());
            return new HashMap<>(snapshot).toString();
        }
    }
}
