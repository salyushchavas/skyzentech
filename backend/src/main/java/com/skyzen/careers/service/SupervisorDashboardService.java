package com.skyzen.careers.service;

import com.skyzen.careers.dto.supervisor.InternRosterRowResponse;
import com.skyzen.careers.dto.supervisor.SupervisorActionItemResponse;
import com.skyzen.careers.dto.supervisor.SupervisorActivityItemResponse;
import com.skyzen.careers.dto.supervisor.SupervisorDashboardResponse;
import com.skyzen.careers.dto.supervisor.SupervisorUpcomingItemResponse;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.EvaluationSession;
import com.skyzen.careers.entity.MaterialAcknowledgement;
import com.skyzen.careers.entity.Timesheet;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.entity.WeeklyMaterial;
import com.skyzen.careers.entity.WeeklyReport;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.EvaluationSessionStatus;
import com.skyzen.careers.enums.EvaluationStatus;
import com.skyzen.careers.enums.TimesheetStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.enums.WeeklyMaterialStatus;
import com.skyzen.careers.enums.WeeklyReportStatus;
import com.skyzen.careers.enums.ProjectStatus;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.EvaluationRepository;
import com.skyzen.careers.repository.EvaluationSessionRepository;
import com.skyzen.careers.repository.MaterialAcknowledgementRepository;
import com.skyzen.careers.repository.ProjectRepository;
import com.skyzen.careers.repository.TimesheetRepository;
import com.skyzen.careers.repository.WeeklyMaterialRepository;
import com.skyzen.careers.repository.WeeklyReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Aggregate read for the Technical Evaluator dashboard. Single read-only
 * transaction. Scope: ACTIVE engagements where the caller is the supervisor;
 * SUPER_ADMIN bypasses the scope and sees every active engagement.
 *
 * <h2>Privilege guarantee</h2>
 * The service deliberately depends on no compliance repositories (I-9 /
 * I-983 / E-Verify) and no admin services (user / entity / audit-export).
 * The DTO surfaces names + positions + cycle-status labels only. Activity
 * feed entries are pre-rendered summaries — never raw audit before/after JSON.
 *
 * <h2>Action queue</h2>
 * Four signal counts, deep-linked:
 * <ul>
 *   <li>Weekly reports awaiting review (SUBMITTED status)</li>
 *   <li>Timesheets pending approval (SUBMITTED status)</li>
 *   <li>Evaluations due (SCHEDULED sessions in the past or this week)</li>
 *   <li>This week's materials not yet published (interns whose engagement
 *       has no RELEASED material visible for this week)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class SupervisorDashboardService {

    private static final int UPCOMING_LIMIT = 8;
    private static final int RECENT_ACTIVITY_LIMIT = 12;
    private static final int ROSTER_LIMIT = 24;

    /** ACTIVE-only — this dashboard is the working roster, not the alumni list. */
    private static final Set<EngagementStatus> ACTIVE_ONLY =
            EnumSet.of(EngagementStatus.ACTIVE);

    private final EngagementRepository engagementRepository;
    private final WeeklyReportRepository weeklyReportRepository;
    private final TimesheetRepository timesheetRepository;
    private final WeeklyMaterialRepository weeklyMaterialRepository;
    private final MaterialAcknowledgementRepository materialAcknowledgementRepository;
    private final EvaluationSessionRepository evaluationSessionRepository;
    private final EvaluationRepository evaluationRepository;
    private final AuditLogRepository auditLogRepository;
    private final ProjectRepository projectRepository;

    @Transactional(readOnly = true)
    public SupervisorDashboardResponse build(User caller) {
        if (caller == null) {
            return empty(null, false);
        }
        boolean isSuperAdmin = caller.getRoles() != null
                && caller.getRoles().contains(UserRole.SUPER_ADMIN);

        // Scope: SUPER_ADMIN sees every ACTIVE engagement; TECHNICAL_EVALUATOR
        // only sees engagements where they're listed as the supervisor.
        List<Engagement> engagements = isSuperAdmin
                ? engagementRepository.findRosterByStatusIn(ACTIVE_ONLY, null, null)
                : engagementRepository.findBySupervisorIdAndStatusIn(caller.getId(), ACTIVE_ONLY);

        if (engagements.isEmpty()) {
            return empty(caller.getFullName(), isSuperAdmin);
        }

        LocalDate weekStart = currentWeekStart();
        Instant now = Instant.now();

        // Build the roster + collect counts in one pass through the engagements.
        long reportsToReview = 0L;
        long timesheetsPending = 0L;
        long evaluationsDue = 0L;
        long materialsNotPublished = 0L;

        List<InternRosterRowResponse> roster = new ArrayList<>(engagements.size());
        // For the activity feed we accumulate the weekly-report ids of this
        // supervisor's interns and look them up in a single repository call.
        Set<UUID> recentReportIds = new HashSet<>();
        Set<UUID> recentTimesheetIds = new HashSet<>();
        // For upcoming evaluation events we accumulate sessions seen per intern.
        List<EvaluationSession> sessionPool = new ArrayList<>();

        Map<UUID, String> internNameByCandidate = new HashMap<>();

        for (Engagement e : engagements) {
            Candidate intern = e.getCandidate();
            if (intern == null || intern.getId() == null) continue;
            UUID candidateId = intern.getId();
            String internName = intern.getUser() != null ? intern.getUser().getFullName() : null;
            internNameByCandidate.put(candidateId, internName);
            String position = e.getApplication() != null && e.getApplication().getJobPosting() != null
                    ? e.getApplication().getJobPosting().getTitle()
                    : null;
            String entityName = e.getEntity() != null ? e.getEntity().getName() : null;

            // This week's report
            WeeklyReport report = weeklyReportRepository
                    .findByInternIdAndWeekStart(candidateId, weekStart)
                    .orElse(null);
            String reportStatus = (report != null && report.getStatus() != null)
                    ? report.getStatus().name() : null;
            if (report != null) recentReportIds.add(report.getId());
            if (report != null && report.getStatus() == WeeklyReportStatus.SUBMITTED) {
                reportsToReview++;
            }

            // This week's timesheet
            Timesheet weekSheet = timesheetRepository.findForIntern(candidateId).stream()
                    .filter(t -> weekStart.equals(t.getWeekStart()))
                    .findFirst()
                    .orElse(null);
            String timesheetStatus = (weekSheet != null && weekSheet.getStatus() != null)
                    ? weekSheet.getStatus().name() : null;
            if (weekSheet != null) recentTimesheetIds.add(weekSheet.getId());
            if (weekSheet != null && weekSheet.getStatus() == TimesheetStatus.SUBMITTED) {
                timesheetsPending++;
            }

            // Material — newest RELEASED visible to this engagement. If none
            // was released this week we count it as "needs to be published".
            List<WeeklyMaterial> visible = weeklyMaterialRepository.findVisibleForEngagement(
                    WeeklyMaterialStatus.RELEASED, e.getId());
            WeeklyMaterial topMaterial = visible.isEmpty() ? null : visible.get(0);
            Boolean materialAcked = null;
            if (topMaterial != null) {
                materialAcked = materialAcknowledgementRepository
                        .findByMaterialIdAndInternId(topMaterial.getId(), candidateId)
                        .isPresent();
            }
            // "Not yet published this week" — topMaterial null OR its release
            // is older than the current Monday.
            boolean publishedThisWeek = topMaterial != null
                    && topMaterial.getReleaseDate() != null
                    && !topMaterial.getReleaseDate()
                            .atZone(ZoneOffset.UTC).toLocalDate().isBefore(weekStart);
            if (!publishedThisWeek) materialsNotPublished++;

            // Last activity — soonest of {report.updated, timesheet.updated,
            // material ack}. Cheap proxy; refine later if needed.
            Instant lastActivity = null;
            if (report != null && report.getUpdatedAt() != null) {
                lastActivity = report.getUpdatedAt();
            }
            if (weekSheet != null && weekSheet.getCreatedAt() != null) {
                if (lastActivity == null || weekSheet.getCreatedAt().isAfter(lastActivity)) {
                    lastActivity = weekSheet.getCreatedAt();
                }
            }

            // Upcoming + overdue evaluations: gather per-candidate via the
            // engagement (preferred) — falls back to user-keyed query if the
            // engagement is null (legacy data).
            List<EvaluationSession> sessions = evaluationSessionRepository
                    .findForIntern(candidateId);
            for (EvaluationSession s : sessions) {
                if (s.getStatus() != EvaluationSessionStatus.SCHEDULED) continue;
                LocalDateTime at = s.getScheduledAt();
                if (at == null) continue;
                LocalDate atDate = at.toLocalDate();
                if (atDate.isBefore(weekStart.plusDays(7))) {
                    // overdue OR this week → "due"
                    evaluationsDue++;
                }
                sessionPool.add(s);
            }

            roster.add(InternRosterRowResponse.builder()
                    .candidateId(candidateId)
                    .engagementId(e.getId())
                    .internName(internName)
                    .position(position)
                    .entityName(entityName)
                    .weekStart(weekStart)
                    .materialAcknowledged(materialAcked)
                    .reportStatus(reportStatus)
                    .timesheetStatus(timesheetStatus)
                    .lastActivityAt(lastActivity)
                    .reviewHref("/careers/evaluator/weekly-reports?intern=" + candidateId)
                    .build());
        }

        // Roster ordering: rows with action items (RETURNED-or-newer report
        // / SUBMITTED timesheet / unack'd this week) bubble up by recency.
        roster.sort(Comparator
                .comparingInt(SupervisorDashboardService::rosterPriority).reversed()
                .thenComparing(InternRosterRowResponse::getInternName,
                        Comparator.nullsLast(Comparator.naturalOrder())));
        if (roster.size() > ROSTER_LIMIT) {
            roster = roster.subList(0, ROSTER_LIMIT);
        }

        long projectsToReview = projectRepository.countByAssignedByIdAndStatus(
                caller.getId(), ProjectStatus.SUBMITTED);

        // DRAFT evaluations authored by this supervisor — periodic eval form
        // started but not finalized yet. SUPER_ADMIN sees their own drafts only
        // here; cross-supervisor visibility lives on the executive surface.
        long evaluationsToFinalize = evaluationRepository
                .countByEvaluatorIdAndStatus(caller.getId(), EvaluationStatus.DRAFT);

        // Action queue — same grammar as the operations / HR dashboards.
        List<SupervisorActionItemResponse> needsAttention = List.of(
                SupervisorActionItemResponse.builder()
                        .key("REPORTS_TO_REVIEW")
                        .label("Weekly reports awaiting review")
                        .count(reportsToReview)
                        .href("/careers/evaluator/weekly-reports")
                        .build(),
                SupervisorActionItemResponse.builder()
                        .key("TIMESHEETS_TO_APPROVE")
                        .label("Timesheets pending approval")
                        .count(timesheetsPending)
                        .href("/careers/evaluator/interns")
                        .build(),
                SupervisorActionItemResponse.builder()
                        .key("PROJECTS_TO_REVIEW")
                        .label("Projects awaiting review")
                        .count(projectsToReview)
                        .href("/careers/evaluator/projects")
                        .build(),
                SupervisorActionItemResponse.builder()
                        .key("EVALUATIONS_TO_FINALIZE")
                        .label("Evaluations to finalize")
                        .count(evaluationsToFinalize)
                        .href("/careers/evaluator/evaluations")
                        .build(),
                SupervisorActionItemResponse.builder()
                        .key("EVALUATIONS_DUE")
                        .label("Evaluations due")
                        .count(evaluationsDue)
                        .href("/careers/evaluator/sessions")
                        .build(),
                SupervisorActionItemResponse.builder()
                        .key("MATERIALS_TO_PUBLISH")
                        .label("This week's materials to publish")
                        .count(materialsNotPublished)
                        .href("/careers/evaluator/weekly-materials")
                        .build()
        );

        // Upcoming — evaluation sessions; sorted soonest-first, cap N.
        List<SupervisorUpcomingItemResponse> upcoming = buildUpcoming(sessionPool, now);

        // Recent activity — pre-rendered audit rows scoped to this supervisor's
        // reports + timesheets. The supervisor doesn't see any wider rows.
        List<SupervisorActivityItemResponse> recentActivity = buildRecentActivity(
                recentReportIds, recentTimesheetIds, internNameByCandidate, roster);

        return SupervisorDashboardResponse.builder()
                .supervisorName(caller.getFullName())
                .isSuperAdminView(isSuperAdmin)
                .needsAttention(needsAttention)
                .internRoster(roster)
                .upcoming(upcoming)
                .recentActivity(recentActivity)
                .build();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** Stable rank used for sorting — rows that need supervisor attention rise. */
    private static int rosterPriority(InternRosterRowResponse r) {
        int p = 0;
        if ("SUBMITTED".equals(r.getReportStatus())) p += 4;
        if ("SUBMITTED".equals(r.getTimesheetStatus())) p += 3;
        // Reports waiting on the intern still need supervisor visibility (the
        // supervisor may want to nudge), just a smaller weight.
        if ("DRAFT".equals(r.getReportStatus())
                || "RETURNED".equals(r.getReportStatus())) p += 1;
        if (Boolean.FALSE.equals(r.getMaterialAcknowledged())) p += 1;
        return p;
    }

    private List<SupervisorUpcomingItemResponse> buildUpcoming(
            List<EvaluationSession> sessions, Instant now) {
        List<SupervisorUpcomingItemResponse> out = new ArrayList<>();
        for (EvaluationSession s : sessions) {
            if (s.getStatus() != EvaluationSessionStatus.SCHEDULED) continue;
            LocalDateTime at = s.getScheduledAt();
            if (at == null) continue;
            Candidate intern = s.getIntern();
            String name = intern != null && intern.getUser() != null
                    ? intern.getUser().getFullName() : null;
            out.add(SupervisorUpcomingItemResponse.builder()
                    .type("EVALUATION")
                    .title("Evaluation" + (name != null ? " — " + name : ""))
                    .subtitle("Scheduled checkpoint")
                    .at(at.toInstant(ZoneOffset.UTC))
                    .href("/careers/evaluator/sessions")
                    .build());
        }
        out.sort(Comparator.comparing(SupervisorUpcomingItemResponse::getAt,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return out.size() > UPCOMING_LIMIT ? out.subList(0, UPCOMING_LIMIT) : out;
    }

    private List<SupervisorActivityItemResponse> buildRecentActivity(
            Set<UUID> reportIds,
            Set<UUID> timesheetIds,
            Map<UUID, String> nameByCandidate,
            List<InternRosterRowResponse> roster) {

        // Map entity_id back to intern name for the feed — cheaper than
        // re-fetching the report/timesheet rows. Built from the roster pass
        // we just made.
        Map<UUID, String> internNameByReportId = new HashMap<>();
        for (UUID reportId : reportIds) {
            weeklyReportRepository.findById(reportId).ifPresent(r -> {
                if (r.getIntern() != null && r.getIntern().getId() != null) {
                    internNameByReportId.put(reportId,
                            nameByCandidate.get(r.getIntern().getId()));
                }
            });
        }
        Map<UUID, String> internNameByTimesheetId = new HashMap<>();
        for (UUID tsId : timesheetIds) {
            timesheetRepository.findById(tsId).ifPresent(t -> {
                if (t.getIntern() != null && t.getIntern().getId() != null) {
                    internNameByTimesheetId.put(tsId,
                            nameByCandidate.get(t.getIntern().getId()));
                }
            });
        }

        List<AuditLog> rows = new ArrayList<>();
        if (!reportIds.isEmpty()) {
            rows.addAll(auditLogRepository.findRecentForEntityIds(
                    "WeeklyReport", reportIds,
                    PageRequest.of(0, RECENT_ACTIVITY_LIMIT)));
        }
        if (!timesheetIds.isEmpty()) {
            rows.addAll(auditLogRepository.findRecentForEntityIds(
                    "Timesheet", timesheetIds,
                    PageRequest.of(0, RECENT_ACTIVITY_LIMIT)));
        }
        rows.sort(Comparator.comparing(AuditLog::getTimestamp,
                Comparator.nullsLast(Comparator.reverseOrder())));

        List<SupervisorActivityItemResponse> out = new ArrayList<>(RECENT_ACTIVITY_LIMIT);
        for (AuditLog a : rows) {
            if (out.size() >= RECENT_ACTIVITY_LIMIT) break;
            String internName = null;
            String href = null;
            if ("WeeklyReport".equals(a.getEntityType()) && a.getEntityId() != null) {
                internName = internNameByReportId.get(a.getEntityId());
                href = "/careers/evaluator/weekly-reports";
            } else if ("Timesheet".equals(a.getEntityType()) && a.getEntityId() != null) {
                internName = internNameByTimesheetId.get(a.getEntityId());
                href = "/careers/evaluator/interns";
            }
            out.add(SupervisorActivityItemResponse.builder()
                    .timestamp(a.getTimestamp())
                    .summary(summarize(a, internName))
                    .internName(internName)
                    .entityType(a.getEntityType())
                    .href(href)
                    .build());
        }
        return out;
    }

    /**
     * Compact pre-rendered summary for an audit row. Same grammar as the HR
     * dashboard's audit feed — never includes raw before/after JSON, never
     * surfaces PII. Resolved against the cycle entity types this dashboard
     * cares about.
     */
    private static String summarize(AuditLog a, String internName) {
        String who = internName != null ? internName : "(intern)";
        String type = a.getEntityType();
        String action = a.getAction();
        if ("WeeklyReport".equals(type)) {
            return switch (action != null ? action : "") {
                case "REPORT_SUBMITTED" -> who + " submitted their weekly report";
                case "REPORT_RETURNED" -> "You returned " + who + "'s report for changes";
                case "REPORT_APPROVED" -> "You approved " + who + "'s report";
                default -> who + " · weekly report " + action;
            };
        }
        if ("Timesheet".equals(type)) {
            return switch (action != null ? action : "") {
                case "STATUS_CHANGE" -> who + " · timesheet status changed";
                case "CREATE" -> who + " logged hours";
                case "APPROVE" -> "You approved " + who + "'s timesheet";
                case "REJECT" -> "You returned " + who + "'s timesheet";
                default -> who + " · timesheet " + action;
            };
        }
        return who + " · " + action;
    }

    private static LocalDate currentWeekStart() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        int back = today.getDayOfWeek().getValue() - DayOfWeek.MONDAY.getValue();
        if (back < 0) back += 7;
        return today.minusDays(back);
    }

    private SupervisorDashboardResponse empty(String name, boolean isSuperAdmin) {
        return SupervisorDashboardResponse.builder()
                .supervisorName(name)
                .isSuperAdminView(isSuperAdmin)
                .needsAttention(List.of(
                        SupervisorActionItemResponse.builder()
                                .key("REPORTS_TO_REVIEW")
                                .label("Weekly reports awaiting review")
                                .count(0L)
                                .href("/careers/evaluator/weekly-reports")
                                .build(),
                        SupervisorActionItemResponse.builder()
                                .key("TIMESHEETS_TO_APPROVE")
                                .label("Timesheets pending approval")
                                .count(0L)
                                .href("/careers/evaluator/interns")
                                .build(),
                        SupervisorActionItemResponse.builder()
                                .key("PROJECTS_TO_REVIEW")
                                .label("Projects awaiting review")
                                .count(0L)
                                .href("/careers/evaluator/projects")
                                .build(),
                        SupervisorActionItemResponse.builder()
                                .key("EVALUATIONS_TO_FINALIZE")
                                .label("Evaluations to finalize")
                                .count(0L)
                                .href("/careers/evaluator/evaluations")
                                .build(),
                        SupervisorActionItemResponse.builder()
                                .key("EVALUATIONS_DUE")
                                .label("Evaluations due")
                                .count(0L)
                                .href("/careers/evaluator/sessions")
                                .build(),
                        SupervisorActionItemResponse.builder()
                                .key("MATERIALS_TO_PUBLISH")
                                .label("This week's materials to publish")
                                .count(0L)
                                .href("/careers/evaluator/weekly-materials")
                                .build()
                ))
                .internRoster(Collections.emptyList())
                .upcoming(Collections.emptyList())
                .recentActivity(Collections.emptyList())
                .build();
    }
}
