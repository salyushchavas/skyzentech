package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.evaluation.CreateEvaluationRequest;
import com.skyzen.careers.dto.evaluation.EvaluationContextResponse;
import com.skyzen.careers.dto.evaluation.EvaluationResponse;
import com.skyzen.careers.dto.evaluation.EvaluationRubricScoreResponse;
import com.skyzen.careers.dto.evaluation.EvaluationSelfReviewResponse;
import com.skyzen.careers.dto.evaluation.SubmitSelfReviewRequest;
import com.skyzen.careers.dto.evaluation.UpdateEvaluationRequest;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Evaluation;
import com.skyzen.careers.entity.EvaluationRubricScore;
import com.skyzen.careers.entity.EvaluationSelfReview;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.Timesheet;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.entity.WeeklyReport;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.EvaluationStatus;
import com.skyzen.careers.enums.EvaluationType;
import com.skyzen.careers.enums.ProjectStatus;
import com.skyzen.careers.enums.TimesheetStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.enums.WeeklyReportStatus;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.EvaluationRepository;
import com.skyzen.careers.repository.EvaluationRubricScoreRepository;
import com.skyzen.careers.repository.EvaluationSelfReviewRepository;
import com.skyzen.careers.repository.ProjectRepository;
import com.skyzen.careers.repository.TimesheetRepository;
import com.skyzen.careers.repository.WeeklyReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Periodic intern evaluations. Supervisor authors; intern reads finalized
 * rows; HR_COMPLIANCE reads (any type, since I-983 is the legally-relevant
 * subset and the rest is HR-relevant too).
 *
 * <h2>Gates</h2>
 * <ul>
 *   <li>Write (create / update / finalize): the engagement's supervisor OR
 *       SUPER_ADMIN.</li>
 *   <li>Read /intern/{id}: that engagement's supervisor OR HR_COMPLIANCE
 *       OR SUPER_ADMIN.</li>
 *   <li>Read /me (intern): only FINALIZED rows for the caller's own
 *       Candidate.</li>
 *   <li>Self-review (intern): only when the parent evaluation is DRAFT and
 *       its type is one of {@code I983_*}.</li>
 * </ul>
 *
 * <h2>FINALIZE lock</h2>
 * {@code PUT /{id}} and rubric changes 409 once the evaluation is FINALIZED.
 * The {@code /finalize} call itself is idempotent (re-clicks return the row
 * with no new audit).
 *
 * <h2>Audit</h2>
 * EVALUATION_CREATED / EVALUATION_FINALIZED / EVALUATION_SELF_SUBMITTED.
 * Best-effort writes.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EvaluationService {

    private static final Set<EvaluationType> SELF_REVIEW_TYPES =
            EnumSet.of(EvaluationType.I983_12MO, EvaluationType.I983_FINAL);

    private final EvaluationRepository evaluationRepository;
    private final EvaluationRubricScoreRepository rubricRepository;
    private final EvaluationSelfReviewRepository selfReviewRepository;
    private final CandidateRepository candidateRepository;
    private final EngagementRepository engagementRepository;
    private final ProjectRepository projectRepository;
    private final WeeklyReportRepository weeklyReportRepository;
    private final TimesheetRepository timesheetRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final com.skyzen.careers.notification.NotificationService notificationService;

    // ── Supervisor write paths ──────────────────────────────────────────────

    @Transactional
    public EvaluationResponse create(CreateEvaluationRequest req, User actor) {
        Candidate intern = candidateRepository.findById(req.getCandidateId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + req.getCandidateId()));
        Engagement engagement = pickEngagement(intern.getId())
                .orElseThrow(() -> new BadRequestException(
                        "Intern has no engagement — can't evaluate yet."));
        ensureSupervisorOwnsEngagement(engagement, actor);

        Evaluation evaluation = Evaluation.builder()
                .intern(intern)
                .engagement(engagement)
                .evaluator(actor)
                .type(req.getType())
                .periodStart(req.getPeriodStart())
                .periodEnd(req.getPeriodEnd())
                .status(EvaluationStatus.DRAFT)
                .build();
        evaluation = evaluationRepository.save(evaluation);
        replaceRubric(evaluation, req.getRubric());

        writeAudit(evaluation.getId(), "EVALUATION_CREATED", actor.getId(), Map.of(
                "type", evaluation.getType().name(),
                "candidateId", intern.getId(),
                "engagementId", engagement.getId()));

        return toResponse(reload(evaluation.getId()), true);
    }

    @Transactional
    public EvaluationResponse update(UUID evaluationId, UpdateEvaluationRequest req, User actor) {
        Evaluation evaluation = evaluationRepository.findByIdWithGraph(evaluationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Evaluation not found: " + evaluationId));
        ensureWriter(evaluation, actor);
        if (evaluation.getStatus() == EvaluationStatus.FINALIZED) {
            throw new ConflictException(
                    "This evaluation is FINALIZED and locked.");
        }

        if (req.getPeriodStart() != null) evaluation.setPeriodStart(req.getPeriodStart());
        if (req.getPeriodEnd() != null) evaluation.setPeriodEnd(req.getPeriodEnd());
        if (req.getOverallRating() != null) {
            evaluation.setOverallRating(clamp(req.getOverallRating()));
        }
        if (req.getStrengths() != null) evaluation.setStrengths(req.getStrengths());
        if (req.getAreasForImprovement() != null) {
            evaluation.setAreasForImprovement(req.getAreasForImprovement());
        }
        if (req.getComments() != null) evaluation.setComments(req.getComments());
        if (req.getRecommendation() != null) evaluation.setRecommendation(req.getRecommendation());

        evaluation = evaluationRepository.save(evaluation);
        if (req.getRubric() != null) {
            replaceRubric(evaluation, req.getRubric());
        }
        return toResponse(reload(evaluation.getId()), true);
    }

    @Transactional
    public EvaluationResponse finalize(UUID evaluationId, User actor) {
        Evaluation evaluation = evaluationRepository.findByIdWithGraph(evaluationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Evaluation not found: " + evaluationId));
        ensureWriter(evaluation, actor);
        if (evaluation.getStatus() == EvaluationStatus.FINALIZED) {
            return toResponse(evaluation, true); // idempotent
        }
        if (evaluation.getOverallRating() == null) {
            throw new BadRequestException(
                    "Set an overall rating before finalizing.");
        }
        evaluation.setStatus(EvaluationStatus.FINALIZED);
        evaluation.setFinalizedAt(Instant.now());
        evaluation = evaluationRepository.save(evaluation);

        writeAudit(evaluation.getId(), "EVALUATION_FINALIZED", actor.getId(), Map.of(
                "type", evaluation.getType().name(),
                "candidateId", evaluation.getIntern().getId()));

        // Batch-3 — intern gets a "your evaluation is ready" email with
        // rating + supervisor name. Best-effort.
        Evaluation reloaded = reload(evaluation.getId());
        try {
            notificationService.sendEvaluationFinalized(reloaded);
        } catch (Exception e) {
            log.warn("EVALUATION_FINALIZED notify failed (non-fatal) for {}: {}",
                    reloaded.getId(), e.getMessage());
        }
        return toResponse(reloaded, true);
    }

    // ── Read paths ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<EvaluationResponse> listForIntern(UUID candidateId, User actor) {
        Candidate intern = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + candidateId));
        ensureCanRead(intern, actor);
        return evaluationRepository.findByInternIdWithGraph(intern.getId()).stream()
                .map(e -> toResponse(e, true))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EvaluationResponse> listMine(User candidateUser) {
        // Auth check — the @PreAuthorize already requires INTERN, this
        // belt-and-braces ensures the user has a Candidate row before any
        // data is returned.
        candidateRepository.findByUserId(candidateUser.getId())
                .orElseThrow(() -> new ForbiddenException(
                        "Evaluations are visible to interns only."));
        return evaluationRepository
                .findFinalizedByCandidateUserIdWithGraph(candidateUser.getId(),
                        EvaluationStatus.FINALIZED)
                .stream()
                .map(e -> toResponse(e, false))
                .toList();
    }

    /** Supervisor's authored evaluations — drives the supervisor board. */
    @Transactional(readOnly = true)
    public List<EvaluationResponse> listAuthored(User actor) {
        return evaluationRepository.findByEvaluatorIdWithGraph(actor.getId()).stream()
                .map(e -> toResponse(e, true))
                .toList();
    }

    /**
     * Intern's self-review surface — DRAFT I-983 evaluations the intern owns,
     * so they can submit a reflection before the supervisor finalizes. Read
     * gate matches {@link #listMine}: must have a Candidate row.
     */
    @Transactional(readOnly = true)
    public List<EvaluationResponse> listSelfReviewable(User candidateUser) {
        candidateRepository.findByUserId(candidateUser.getId())
                .orElseThrow(() -> new ForbiddenException(
                        "Evaluations are visible to interns only."));
        return evaluationRepository
                .findSelfReviewableDraftsByCandidateUserIdWithGraph(candidateUser.getId())
                .stream()
                .map(e -> toResponse(e, false))
                .toList();
    }

    // ── Intern self-review ──────────────────────────────────────────────────

    @Transactional
    public EvaluationResponse submitSelfReview(UUID evaluationId,
                                               SubmitSelfReviewRequest req,
                                               User candidateUser) {
        Evaluation evaluation = evaluationRepository.findByIdWithGraph(evaluationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Evaluation not found: " + evaluationId));
        Candidate candidate = candidateRepository.findByUserId(candidateUser.getId())
                .orElseThrow(() -> new ForbiddenException(
                        "Self-review is available to interns only."));
        if (!evaluation.getIntern().getId().equals(candidate.getId())) {
            // Don't leak existence.
            throw new ResourceNotFoundException(
                    "Evaluation not found: " + evaluationId);
        }
        if (!SELF_REVIEW_TYPES.contains(evaluation.getType())) {
            throw new BadRequestException(
                    "Self-review isn't available for this evaluation type.");
        }
        if (evaluation.getStatus() == EvaluationStatus.FINALIZED) {
            throw new ConflictException(
                    "This evaluation is finalized; self-review window is closed.");
        }

        EvaluationSelfReview existing = selfReviewRepository
                .findByEvaluationId(evaluation.getId())
                .orElseGet(() -> EvaluationSelfReview.builder()
                        .evaluation(evaluation).build());
        if (req != null) {
            if (req.getReflection() != null) existing.setReflection(req.getReflection());
            if (req.getSelfOverallRating() != null) {
                existing.setSelfOverallRating(clamp(req.getSelfOverallRating()));
            }
            if (req.getSelfTechnicalRating() != null) {
                existing.setSelfTechnicalRating(clamp(req.getSelfTechnicalRating()));
            }
            if (req.getSelfGrowthRating() != null) {
                existing.setSelfGrowthRating(clamp(req.getSelfGrowthRating()));
            }
        }
        existing.setSubmittedAt(Instant.now());
        selfReviewRepository.save(existing);

        writeAudit(evaluation.getId(), "EVALUATION_SELF_SUBMITTED", candidateUser.getId(),
                Map.of("type", evaluation.getType().name()));

        return toResponse(reload(evaluation.getId()), false);
    }

    // ── Gates ───────────────────────────────────────────────────────────────

    private Optional<Engagement> pickEngagement(UUID candidateId) {
        return engagementRepository.findByCandidateId(candidateId).stream()
                .filter(e -> e.getStatus() != EngagementStatus.TERMINATED)
                .max(Comparator.comparing(Engagement::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())));
    }

    private void ensureSupervisorOwnsEngagement(Engagement engagement, User actor) {
        if (actor == null) throw new ForbiddenException("Authentication required.");
        if (isSuperAdmin(actor)) return;
        User supervisor = engagement.getSupervisor();
        if (supervisor == null || !supervisor.getId().equals(actor.getId())) {
            throw new ForbiddenException(
                    "Only the engagement's supervisor (or SUPER_ADMIN) may author evaluations here.");
        }
    }

    private void ensureWriter(Evaluation evaluation, User actor) {
        if (actor == null) throw new ForbiddenException("Authentication required.");
        if (isSuperAdmin(actor)) return;
        // The original evaluator OR the engagement's current supervisor can write.
        if (evaluation.getEvaluator() != null
                && evaluation.getEvaluator().getId().equals(actor.getId())) {
            return;
        }
        ensureSupervisorOwnsEngagement(evaluation.getEngagement(), actor);
    }

    private void ensureCanRead(Candidate intern, User actor) {
        if (actor == null) throw new ForbiddenException("Authentication required.");
        if (isSuperAdmin(actor)) return;
        // HR_COMPLIANCE may read (incl. I-983 types).
        if (actor.getRoles() != null
                && actor.getRoles().contains(UserRole.HR_COMPLIANCE)) {
            return;
        }
        // Otherwise the actor must supervise one of the candidate's engagements.
        List<Engagement> engagements = engagementRepository.findByCandidateId(intern.getId());
        boolean supervises = engagements.stream().anyMatch(e ->
                e.getSupervisor() != null
                        && e.getSupervisor().getId().equals(actor.getId()));
        if (!supervises) {
            throw new ForbiddenException(
                    "Only this intern's supervisor, HR, or SUPER_ADMIN may view their evaluations.");
        }
    }

    private static boolean isSuperAdmin(User u) {
        return u.getRoles() != null && u.getRoles().contains(UserRole.SUPER_ADMIN);
    }

    private static Integer clamp(Integer raw) {
        if (raw == null) return null;
        return Math.max(1, Math.min(5, raw));
    }

    // ── Rubric handling ─────────────────────────────────────────────────────

    private void replaceRubric(Evaluation evaluation,
                               List<CreateEvaluationRequest.RubricScoreInput> rows) {
        rubricRepository.deleteByEvaluationId(evaluation.getId());
        if (rows == null || rows.isEmpty()) return;
        for (CreateEvaluationRequest.RubricScoreInput row : rows) {
            if (row == null || row.getCriterion() == null || row.getScore() == null) continue;
            rubricRepository.save(EvaluationRubricScore.builder()
                    .evaluation(evaluation)
                    .criterion(row.getCriterion())
                    .score(clamp(row.getScore()))
                    .note(row.getNote())
                    .build());
        }
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private Evaluation reload(UUID id) {
        return evaluationRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Evaluation not found: " + id));
    }

    private EvaluationResponse toResponse(Evaluation e, boolean withContext) {
        List<EvaluationRubricScore> rubricRows = rubricRepository
                .findByEvaluationId(e.getId());
        EvaluationSelfReview self = selfReviewRepository
                .findByEvaluationId(e.getId()).orElse(null);
        Candidate intern = e.getIntern();
        User internUser = intern != null ? intern.getUser() : null;
        EvaluationContextResponse context = withContext
                ? buildContext(intern, e.getPeriodStart(), e.getPeriodEnd()) : null;

        return EvaluationResponse.builder()
                .id(e.getId())
                .internCandidateId(intern != null ? intern.getId() : null)
                .internName(internUser != null ? internUser.getFullName() : null)
                .engagementId(e.getEngagement() != null ? e.getEngagement().getId() : null)
                .evaluatorId(e.getEvaluator() != null ? e.getEvaluator().getId() : null)
                .evaluatorName(e.getEvaluator() != null ? e.getEvaluator().getFullName() : null)
                .type(e.getType())
                .periodStart(e.getPeriodStart())
                .periodEnd(e.getPeriodEnd())
                .overallRating(e.getOverallRating())
                .strengths(e.getStrengths())
                .areasForImprovement(e.getAreasForImprovement())
                .comments(e.getComments())
                .recommendation(e.getRecommendation())
                .status(e.getStatus())
                .createdAt(e.getCreatedAt())
                .finalizedAt(e.getFinalizedAt())
                .updatedAt(e.getUpdatedAt())
                .rubric(rubricRows.stream().map(this::toRubricResponse).toList())
                .selfReview(self != null ? toSelfReviewResponse(self) : null)
                .context(context)
                .build();
    }

    private EvaluationRubricScoreResponse toRubricResponse(EvaluationRubricScore r) {
        return EvaluationRubricScoreResponse.builder()
                .id(r.getId())
                .criterion(r.getCriterion())
                .score(r.getScore())
                .note(r.getNote())
                .build();
    }

    private EvaluationSelfReviewResponse toSelfReviewResponse(EvaluationSelfReview s) {
        return EvaluationSelfReviewResponse.builder()
                .id(s.getId())
                .reflection(s.getReflection())
                .selfOverallRating(s.getSelfOverallRating())
                .selfTechnicalRating(s.getSelfTechnicalRating())
                .selfGrowthRating(s.getSelfGrowthRating())
                .submittedAt(s.getSubmittedAt())
                .build();
    }

    // ── Context block ───────────────────────────────────────────────────────

    private EvaluationContextResponse buildContext(Candidate intern,
                                                   LocalDate periodStart,
                                                   LocalDate periodEnd) {
        if (intern == null || intern.getId() == null) return null;
        UUID candidateId = intern.getId();

        // COMPLETED projects within the period (loose match — if either bound
        // is null we still show the row).
        List<Project> projects = projectRepository.findByInternIdWithGraph(candidateId);
        List<EvaluationContextResponse.CompletedProjectMini> completedProjects = new ArrayList<>();
        for (Project p : projects) {
            if (p.getStatus() != ProjectStatus.COMPLETED) continue;
            LocalDate completedOn = p.getCompletedAt() != null
                    ? p.getCompletedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate()
                    : null;
            if (!withinPeriod(completedOn, periodStart, periodEnd)) continue;
            completedProjects.add(EvaluationContextResponse.CompletedProjectMini.builder()
                    .id(p.getId())
                    .title(p.getTitle())
                    .completedDate(completedOn)
                    .build());
        }

        // Weekly reports — counts in period (filter by weekStart).
        List<WeeklyReport> reports = weeklyReportRepository.findByInternIdWithGraph(candidateId);
        long total = 0, approved = 0, returned = 0, pending = 0;
        for (WeeklyReport r : reports) {
            if (!withinPeriod(r.getWeekStart(), periodStart, periodEnd)) continue;
            total++;
            WeeklyReportStatus s = r.getStatus();
            if (s == WeeklyReportStatus.APPROVED) approved++;
            else if (s == WeeklyReportStatus.RETURNED) returned++;
            else if (s == WeeklyReportStatus.SUBMITTED || s == WeeklyReportStatus.DRAFT) pending++;
        }

        // Timesheets — count + approved hours in period.
        List<Timesheet> sheets = timesheetRepository.findForIntern(candidateId);
        long sheetTotal = 0, sheetApproved = 0;
        BigDecimal hours = BigDecimal.ZERO;
        for (Timesheet t : sheets) {
            if (!withinPeriod(t.getWeekStart(), periodStart, periodEnd)) continue;
            sheetTotal++;
            if (t.getStatus() == TimesheetStatus.APPROVED) {
                sheetApproved++;
                if (t.getHours() != null) hours = hours.add(t.getHours());
            }
        }

        return EvaluationContextResponse.builder()
                .completedProjects(completedProjects)
                .reportStats(EvaluationContextResponse.ReportStats.builder()
                        .totalCount(total)
                        .approvedCount(approved)
                        .returnedCount(returned)
                        .pendingCount(pending)
                        .build())
                .timesheetStats(EvaluationContextResponse.TimesheetStats.builder()
                        .totalCount(sheetTotal)
                        .approvedCount(sheetApproved)
                        .approvedHours(hours.setScale(2, RoundingMode.HALF_UP).toPlainString())
                        .build())
                .build();
    }

    private boolean withinPeriod(LocalDate when, LocalDate start, LocalDate end) {
        if (when == null) return start == null && end == null;
        if (start != null && when.isBefore(start)) return false;
        if (end != null && when.isAfter(end)) return false;
        return true;
    }

    // ── Audit ───────────────────────────────────────────────────────────────

    private void writeAudit(UUID evaluationId, String action, UUID userId,
                            Map<String, Object> snapshot) {
        Map<String, Object> after = snapshot != null
                ? new LinkedHashMap<>(snapshot) : new LinkedHashMap<>();
        AuditLog entry = AuditLog.builder()
                .entityType("Evaluation")
                .entityId(evaluationId)
                .action(action)
                .userId(userId)
                .afterJson(serializeJson(after))
                .build();
        try {
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("Failed to write {} audit row (non-fatal): {}", action, e.getMessage());
        }
    }

    private String serializeJson(Map<String, Object> snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize evaluation audit snapshot: {}", e.getMessage());
            return String.valueOf(snapshot);
        }
    }

}
