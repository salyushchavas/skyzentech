package com.skyzen.careers.erm.exception;

import com.skyzen.careers.erm.dashboard.ErmScope;
import com.skyzen.careers.erm.dashboard.ErmThresholds;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phase 1 — compute-on-demand exception detector for the ERM Home
 * dashboard. Eight independent SQL counts + a small top-urgent union
 * keep the call cheap (each query indexed per
 * {@link com.skyzen.careers.bootstrap.SchemaFixupRunner}). Phase 6 will
 * add a scheduled job that persists rows into a dedicated table; for
 * Phase 1 the service is read-only and idempotent.
 *
 * <p>All queries operate at the SQL layer — no in-memory scanning of
 * large lists. JdbcTemplate is used instead of repositories so the
 * cross-entity joins stay clean and the column names match what the
 * existing schema actually carries.</p>
 *
 * <p>Severity assignment matches the doc: timing-risk and overdue-offer
 * are URGENT; document/project/meeting/evaluation/exit are WARN; the
 * timesheet flag is INFO.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExceptionDetectionService {

    /** Per-type severity, declared once so the mapping stays consistent. */
    private static final Map<ExceptionType, ExceptionSeverity> SEVERITY =
            new EnumMap<>(ExceptionType.class);
    static {
        SEVERITY.put(ExceptionType.UNSIGNED_OFFER_OVERDUE,  ExceptionSeverity.URGENT);
        SEVERITY.put(ExceptionType.ONBOARDING_DOC_REJECTED, ExceptionSeverity.WARN);
        SEVERITY.put(ExceptionType.I9_EVERIFY_TIMING_RISK,  ExceptionSeverity.URGENT);
        SEVERITY.put(ExceptionType.NO_PROJECT_ASSIGNED,     ExceptionSeverity.WARN);
        SEVERITY.put(ExceptionType.TRAINER_MEETING_MISSING, ExceptionSeverity.WARN);
        SEVERITY.put(ExceptionType.EVALUATION_OVERDUE,      ExceptionSeverity.WARN);
        SEVERITY.put(ExceptionType.TIMESHEET_MISSING,       ExceptionSeverity.INFO);
        SEVERITY.put(ExceptionType.EXIT_CHECKLIST_PENDING,  ExceptionSeverity.WARN);
        SEVERITY.put(ExceptionType.REPORTING_STRUCTURE_INCOMPLETE,
                ExceptionSeverity.URGENT);
        SEVERITY.put(ExceptionType.WORK_AUTH_EXPIRING_30,   ExceptionSeverity.URGENT);
        SEVERITY.put(ExceptionType.I983_EVALUATION_OVERDUE, ExceptionSeverity.WARN);
        SEVERITY.put(ExceptionType.EVERIFY_NONCONFIRMATION, ExceptionSeverity.URGENT);
    }

    private static final int TOP_URGENT_LIMIT = 5;

    private final JdbcTemplate jdbc;

    public ExceptionDetectionResult detect(ErmScope scope, UUID callerId) {
        Map<ExceptionType, Integer> counts = new EnumMap<>(ExceptionType.class);
        List<ExceptionRow> all = new ArrayList<>();

        runDetector(ExceptionType.UNSIGNED_OFFER_OVERDUE,
                this::unsignedOfferOverdue, scope, callerId, counts, all);
        runDetector(ExceptionType.ONBOARDING_DOC_REJECTED,
                this::onboardingDocRejected, scope, callerId, counts, all);
        runDetector(ExceptionType.I9_EVERIFY_TIMING_RISK,
                this::i9EverifyTimingRisk, scope, callerId, counts, all);
        runDetector(ExceptionType.NO_PROJECT_ASSIGNED,
                this::noProjectAssigned, scope, callerId, counts, all);
        runDetector(ExceptionType.TRAINER_MEETING_MISSING,
                this::trainerMeetingMissing, scope, callerId, counts, all);
        runDetector(ExceptionType.EVALUATION_OVERDUE,
                this::evaluationOverdue, scope, callerId, counts, all);
        runDetector(ExceptionType.TIMESHEET_MISSING,
                this::timesheetMissing, scope, callerId, counts, all);
        runDetector(ExceptionType.EXIT_CHECKLIST_PENDING,
                this::exitChecklistPending, scope, callerId, counts, all);
        runDetector(ExceptionType.REPORTING_STRUCTURE_INCOMPLETE,
                this::reportingStructureIncomplete, scope, callerId, counts, all);
        runDetector(ExceptionType.WORK_AUTH_EXPIRING_30,
                this::workAuthExpiring30, scope, callerId, counts, all);
        runDetector(ExceptionType.I983_EVALUATION_OVERDUE,
                this::i983EvaluationOverdue, scope, callerId, counts, all);
        runDetector(ExceptionType.EVERIFY_NONCONFIRMATION,
                this::everifyNonconfirmation, scope, callerId, counts, all);

        // Guarantee every enum value is keyed (zeros for empty detectors).
        for (ExceptionType t : ExceptionType.values()) {
            counts.putIfAbsent(t, 0);
        }

        List<ExceptionRow> topUrgent = all.stream()
                .sorted(Comparator
                        .comparing((ExceptionRow r) -> severityRank(r.severity()))
                        .thenComparing(Comparator.comparingInt(ExceptionRow::daysOverdue).reversed()))
                .limit(TOP_URGENT_LIMIT)
                .toList();

        return new ExceptionDetectionResult(counts, topUrgent);
    }

    private void runDetector(ExceptionType type,
                              Detector detector,
                              ErmScope scope,
                              UUID callerId,
                              Map<ExceptionType, Integer> counts,
                              List<ExceptionRow> all) {
        try {
            List<ExceptionRow> rows = detector.run(scope, callerId);
            counts.put(type, rows.size());
            all.addAll(rows);
        } catch (Exception e) {
            log.warn("[ExceptionDetection] {} failed (non-fatal): {}", type, e.getMessage());
            counts.putIfAbsent(type, 0);
        }
    }

    @FunctionalInterface
    private interface Detector {
        List<ExceptionRow> run(ErmScope scope, UUID callerId);
    }

    private static int severityRank(ExceptionSeverity s) {
        return switch (s) {
            case URGENT -> 0;
            case WARN -> 1;
            case INFO -> 2;
        };
    }

    private static String scopeJoinErm(ErmScope scope) {
        return scope == ErmScope.MINE ? " AND il.erm_id = ?" : "";
    }

    // ── Detector 1: unsigned offer past expiry ─────────────────────────────

    private List<ExceptionRow> unsignedOfferOverdue(ErmScope scope, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT o.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       EXTRACT(EPOCH FROM (NOW() - o.expires_at))/86400 AS days_overdue ")
                .append("  FROM offers o ")
                .append("  JOIN applications a ON a.id = o.application_id ")
                .append("  JOIN candidates c   ON c.id = a.candidate_id ")
                .append("  JOIN users u        ON u.id = c.user_id ")
                .append("  LEFT JOIN intern_lifecycles il ON il.user_id = u.id ")
                .append(" WHERE o.status = 'SENT' AND o.expires_at < NOW() ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(" AND (o.created_by = ? OR il.erm_id = ?) ");
            params.add(callerId);
            params.add(callerId);
        }
        sql.append(" ORDER BY o.expires_at ASC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.UNSIGNED_OFFER_OVERDUE,
                        ExceptionSeverity.URGENT,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, (int) rs.getDouble("days_overdue")),
                        "/careers/erm/offers",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 2: onboarding doc rejected, awaiting resubmission ─────────

    private List<ExceptionRow> onboardingDocRejected(ErmScope scope, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT oi.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       EXTRACT(EPOCH FROM (NOW() - oi.reviewed_at))/86400 AS days_overdue ")
                .append("  FROM onboarding_items oi ")
                .append("  JOIN onboarding_packets pk ON pk.id = oi.packet_id ")
                .append("  JOIN intern_lifecycles il  ON il.id = pk.intern_lifecycle_id ")
                .append("  JOIN users u               ON u.id = il.user_id ")
                .append(" WHERE oi.status = 'REJECTED' ")
                .append("   AND oi.reviewed_at IS NOT NULL ")
                .append("   AND oi.reviewed_at > NOW() - INTERVAL '")
                .append(ErmThresholds.DOC_REJECTED_FOLLOWUP_DAYS).append(" days' ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(" AND il.erm_id = ? ");
            params.add(callerId);
        }
        sql.append(" ORDER BY oi.reviewed_at ASC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.ONBOARDING_DOC_REJECTED,
                        ExceptionSeverity.WARN,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, (int) rs.getDouble("days_overdue")),
                        "/careers/erm/onboarding",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 3: I-9 §2 / E-Verify timing risk ──────────────────────────

    private List<ExceptionRow> i9EverifyTimingRisk(ErmScope scope, UUID callerId) {
        // Active intern, start date reached, but I-9 not COMPLETED N business
        // days past start, OR I-9 done but no EVERIFY EMPLOYMENT_AUTHORIZED yet.
        // Approximates business-day window as N calendar days (Phase 1 trade-off).
        StringBuilder sql = new StringBuilder()
                .append("SELECT u.id AS intern_id, u.full_name AS intern_name, f.id AS resource_id, ")
                .append("       EXTRACT(EPOCH FROM (NOW() - (f.first_day_of_employment + INTERVAL '")
                .append(ErmThresholds.I9_EVERIFY_OVERDUE_DAYS).append(" days')))/86400 AS days_overdue ")
                .append("  FROM i9_forms f ")
                .append("  JOIN candidates c ON c.id = f.candidate_id ")
                .append("  JOIN users u      ON u.id = c.user_id ")
                .append("  JOIN intern_lifecycles il ON il.user_id = u.id ")
                .append(" WHERE il.active_status = 'ACTIVE' ")
                .append("   AND f.first_day_of_employment IS NOT NULL ")
                .append("   AND f.first_day_of_employment + INTERVAL '")
                .append(ErmThresholds.I9_EVERIFY_OVERDUE_DAYS).append(" days' < CURRENT_DATE ")
                .append("   AND ( f.status <> 'COMPLETED' ")
                .append("         OR NOT EXISTS (SELECT 1 FROM everify_cases ec ")
                .append("                          WHERE ec.i9_form_id = f.id ")
                .append("                            AND ec.status = 'EMPLOYMENT_AUTHORIZED') ) ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(" AND il.erm_id = ? ");
            params.add(callerId);
        }
        sql.append(" ORDER BY f.first_day_of_employment ASC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.I9_EVERIFY_TIMING_RISK,
                        ExceptionSeverity.URGENT,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, (int) rs.getDouble("days_overdue")),
                        "/careers/erm/compliance",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 4: active intern with no open project ─────────────────────

    private List<ExceptionRow> noProjectAssigned(ErmScope scope, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT il.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       EXTRACT(EPOCH FROM (NOW() - il.started_at))/86400 AS days_overdue ")
                .append("  FROM intern_lifecycles il ")
                .append("  JOIN users u ON u.id = il.user_id ")
                .append(" WHERE il.active_status = 'ACTIVE' ")
                .append("   AND il.started_at IS NOT NULL ")
                .append("   AND il.started_at < NOW() - INTERVAL '")
                .append(ErmThresholds.NO_PROJECT_OVERDUE_DAYS).append(" days' ")
                .append("   AND NOT EXISTS (SELECT 1 FROM project_assignments pa ")
                .append("                     WHERE pa.intern_id = u.id ")
                .append("                       AND pa.status NOT IN ('COMPLETED','RETURNED','CANCELLED')) ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(scopeJoinErm(scope));
            params.add(callerId);
        }
        sql.append(" ORDER BY il.started_at ASC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.NO_PROJECT_ASSIGNED,
                        ExceptionSeverity.WARN,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, (int) rs.getDouble("days_overdue")),
                        "/careers/erm/active-interns",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 5: trainer weekly meeting missing ─────────────────────────

    private List<ExceptionRow> trainerMeetingMissing(ErmScope scope, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT il.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       ").append(ErmThresholds.TRAINER_MEETING_MISSING_DAYS)
                .append(" AS days_overdue ")
                .append("  FROM intern_lifecycles il ")
                .append("  JOIN users u ON u.id = il.user_id ")
                .append(" WHERE il.active_status = 'ACTIVE' ")
                .append("   AND il.trainer_id IS NOT NULL ")
                .append("   AND NOT EXISTS (SELECT 1 FROM weekly_meetings wm ")
                .append("                     WHERE wm.intern_lifecycle_id = il.id ")
                .append("                       AND wm.scheduled_for > NOW() - INTERVAL '")
                .append(ErmThresholds.TRAINER_MEETING_MISSING_DAYS).append(" days' ")
                .append("                       AND wm.status IN ('SCHEDULED','COMPLETED')) ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(scopeJoinErm(scope));
            params.add(callerId);
        }
        sql.append(" ORDER BY u.full_name ASC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.TRAINER_MEETING_MISSING,
                        ExceptionSeverity.WARN,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        rs.getInt("days_overdue"),
                        "/careers/erm/active-interns",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 6: evaluation overdue ────────────────────────────────────

    private List<ExceptionRow> evaluationOverdue(ErmScope scope, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT il.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       GREATEST( ")
                .append("         EXTRACT(EPOCH FROM (NOW() - COALESCE(maxEval.published_at, il.started_at)))/86400, 0 ")
                .append("       ) AS days_overdue ")
                .append("  FROM intern_lifecycles il ")
                .append("  JOIN users u ON u.id = il.user_id ")
                .append("  LEFT JOIN ( ")
                .append("    SELECT intern_lifecycle_id, MAX(published_at) AS published_at ")
                .append("      FROM intern_evaluations ")
                .append("     WHERE evaluation_type = 'MONTHLY' ")
                .append("       AND status IN ('PUBLISHED','ACKNOWLEDGED','AMENDED') ")
                .append("     GROUP BY intern_lifecycle_id ")
                .append("  ) maxEval ON maxEval.intern_lifecycle_id = il.id ")
                .append(" WHERE il.active_status = 'ACTIVE' ")
                .append("   AND il.started_at IS NOT NULL ")
                .append("   AND COALESCE(maxEval.published_at, il.started_at) < NOW() - INTERVAL '")
                .append(ErmThresholds.EVAL_OVERDUE_DAYS).append(" days' ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(scopeJoinErm(scope));
            params.add(callerId);
        }
        sql.append(" ORDER BY days_overdue DESC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.EVALUATION_OVERDUE,
                        ExceptionSeverity.WARN,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, (int) rs.getDouble("days_overdue")),
                        "/careers/erm/active-interns?filter=eval-overdue",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 7: timesheet missing for previous week ───────────────────

    private List<ExceptionRow> timesheetMissing(ErmScope scope, UUID callerId) {
        // Previous Mon-Sun week. Postgres: date_trunc('week', NOW()) - INTERVAL '7 days'
        StringBuilder sql = new StringBuilder()
                .append("WITH last_week AS (SELECT (date_trunc('week', NOW()) - INTERVAL '7 days')::date AS start_date) ")
                .append("SELECT il.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       EXTRACT(EPOCH FROM (NOW() - (SELECT start_date FROM last_week)))/86400 AS days_overdue ")
                .append("  FROM intern_lifecycles il ")
                .append("  JOIN users u ON u.id = il.user_id ")
                .append(" WHERE il.active_status = 'ACTIVE' ")
                .append("   AND NOT EXISTS (SELECT 1 FROM timesheets t ")
                .append("                     WHERE t.intern_id = u.id ")
                .append("                       AND t.week_start = (SELECT start_date FROM last_week) ")
                .append("                       AND t.status IN ('SUBMITTED','APPROVED')) ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(scopeJoinErm(scope));
            params.add(callerId);
        }
        sql.append(" ORDER BY u.full_name ASC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.TIMESHEET_MISSING,
                        ExceptionSeverity.INFO,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, (int) rs.getDouble("days_overdue")),
                        "/careers/erm/timesheets",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 8: exit checklist pending past exit_date + window ────────

    private List<ExceptionRow> exitChecklistPending(ErmScope scope, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT er.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       (CURRENT_DATE - er.exit_date) AS days_overdue ")
                .append("  FROM exit_records er ")
                .append("  JOIN intern_lifecycles il ON il.id = er.intern_lifecycle_id ")
                .append("  JOIN users u ON u.id = il.user_id ")
                .append(" WHERE er.exit_date < CURRENT_DATE - INTERVAL '")
                .append(ErmThresholds.EXIT_CHECKLIST_PENDING_DAYS).append(" days' ")
                .append("   AND (er.access_revocation_done = FALSE OR er.final_documents_archived = FALSE) ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(" AND il.erm_id = ? ");
            params.add(callerId);
        }
        sql.append(" ORDER BY er.exit_date ASC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.EXIT_CHECKLIST_PENDING,
                        ExceptionSeverity.WARN,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, rs.getInt("days_overdue")),
                        "/careers/erm/exits",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 9: reporting structure incomplete (ERM Phase 4) ──────────

    private List<ExceptionRow> reportingStructureIncomplete(ErmScope scope, UUID callerId) {
        // New hires whose offer is signed but ERM has not yet wired the
        // mandatory Trainer + Evaluator + Manager triad. Filter to those
        // signed > 24h ago so brand-new arrivals don't immediately scream.
        StringBuilder sql = new StringBuilder()
                .append("SELECT il.id AS resource_id, il.user_id AS intern_id, ")
                .append("       u.full_name AS intern_name, ")
                .append("       EXTRACT(EPOCH FROM (NOW() - il.hired_at))/86400 AS days_overdue ")
                .append("  FROM intern_lifecycles il ")
                .append("  JOIN users u ON u.id = il.user_id ")
                .append(" WHERE il.active_status = 'PROSPECTIVE' ")
                .append("   AND il.reporting_structure_complete = FALSE ")
                .append("   AND il.hired_at < NOW() - INTERVAL '1 day' ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(" AND il.erm_id = ? ");
            params.add(callerId);
        }
        sql.append(" ORDER BY il.hired_at ASC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.REPORTING_STRUCTURE_INCOMPLETE,
                        ExceptionSeverity.URGENT,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, (int) rs.getDouble("days_overdue")),
                        "/careers/erm/new-hire?tab=pending",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 10: work auth expiring within 30 days (ERM Phase 5) ──────

    private List<ExceptionRow> workAuthExpiring30(ErmScope scope, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT w.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       (CURRENT_DATE - LEAST( ")
                .append("            COALESCE(w.authorized_until, CURRENT_DATE + INTERVAL '999 days')::date, ")
                .append("            COALESCE(w.ead_expiration,    CURRENT_DATE + INTERVAL '999 days')::date, ")
                .append("            COALESCE(w.i20_expiration,    CURRENT_DATE + INTERVAL '999 days')::date ")
                .append("       )) AS days_overdue ")
                .append("  FROM work_authorization_records w ")
                .append("  JOIN users u ON u.id = w.user_id ")
                .append("  JOIN intern_lifecycles il ON il.user_id = u.id ")
                .append(" WHERE il.active_status IN ('ACTIVE','PROSPECTIVE') ")
                .append("   AND LEAST( ")
                .append("        COALESCE(w.authorized_until, CURRENT_DATE + INTERVAL '999 days')::date, ")
                .append("        COALESCE(w.ead_expiration,    CURRENT_DATE + INTERVAL '999 days')::date, ")
                .append("        COALESCE(w.i20_expiration,    CURRENT_DATE + INTERVAL '999 days')::date ")
                .append("       ) <= CURRENT_DATE + INTERVAL '30 days' ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(" AND il.erm_id = ? ");
            params.add(callerId);
        }
        sql.append(" ORDER BY days_overdue DESC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.WORK_AUTH_EXPIRING_30,
                        ExceptionSeverity.URGENT,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        rs.getInt("days_overdue"),
                        "/careers/erm/compliance",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 11: F-1 CPT/OPT/STEM-OPT intern overdue I-983 evaluation ──

    private List<ExceptionRow> i983EvaluationOverdue(ErmScope scope, UUID callerId) {
        // STEM OPT requires a 6-month + 12-month evaluation. Surfaces any
        // active intern with i983_required=TRUE whose latest published
        // monthly evaluation (proxy for the 6-month checkpoint) is older
        // than 180 days, OR who has none yet 180 days into the engagement.
        StringBuilder sql = new StringBuilder()
                .append("SELECT il.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       GREATEST(EXTRACT(EPOCH FROM (NOW() - COALESCE(maxEval.published_at, il.started_at)))/86400 - 180, 0) ")
                .append("         AS days_overdue ")
                .append("  FROM work_authorization_records w ")
                .append("  JOIN users u ON u.id = w.user_id ")
                .append("  JOIN intern_lifecycles il ON il.user_id = u.id ")
                .append("  LEFT JOIN ( ")
                .append("    SELECT intern_lifecycle_id, MAX(published_at) AS published_at ")
                .append("      FROM intern_evaluations ")
                .append("     WHERE evaluation_type = 'MONTHLY' ")
                .append("       AND status IN ('PUBLISHED','ACKNOWLEDGED','AMENDED') ")
                .append("     GROUP BY intern_lifecycle_id ")
                .append("  ) maxEval ON maxEval.intern_lifecycle_id = il.id ")
                .append(" WHERE il.active_status = 'ACTIVE' ")
                .append("   AND w.i983_required = TRUE ")
                .append("   AND il.started_at IS NOT NULL ")
                .append("   AND COALESCE(maxEval.published_at, il.started_at) < NOW() - INTERVAL '180 days' ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(" AND il.erm_id = ? ");
            params.add(callerId);
        }
        sql.append(" ORDER BY days_overdue DESC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.I983_EVALUATION_OVERDUE,
                        ExceptionSeverity.WARN,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, (int) rs.getDouble("days_overdue")),
                        "/careers/erm/compliance",
                        nullableUuid(rs.getString("resource_id"))));
    }

    // ── Detector 12: E-Verify case stuck in TENTATIVE_NONCONFIRMATION ──────

    private List<ExceptionRow> everifyNonconfirmation(ErmScope scope, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT ec.id AS resource_id, u.id AS intern_id, u.full_name AS intern_name, ")
                .append("       (CURRENT_DATE - COALESCE(ec.expected_close_by, ec.opened_at::date)) AS days_overdue ")
                .append("  FROM everify_cases ec ")
                .append("  JOIN i9_forms f       ON f.id = ec.i9_form_id ")
                .append("  JOIN candidates c     ON c.id = f.candidate_id ")
                .append("  JOIN users u          ON u.id = c.user_id ")
                .append("  JOIN intern_lifecycles il ON il.user_id = u.id ")
                .append(" WHERE ec.status = 'TENTATIVE_NONCONFIRMATION' ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(" AND il.erm_id = ? ");
            params.add(callerId);
        }
        sql.append(" ORDER BY days_overdue DESC");
        return jdbc.query(sql.toString(), params.toArray(),
                (rs, n) -> new ExceptionRow(
                        ExceptionType.EVERIFY_NONCONFIRMATION,
                        ExceptionSeverity.URGENT,
                        nullableUuid(rs.getString("intern_id")),
                        rs.getString("intern_name"),
                        Math.max(0, rs.getInt("days_overdue")),
                        "/careers/erm/compliance",
                        nullableUuid(rs.getString("resource_id"))));
    }

    private static UUID nullableUuid(String s) {
        if (s == null || s.isBlank()) return null;
        try { return UUID.fromString(s); } catch (Exception e) { return null; }
    }

    public ExceptionSeverity severityOf(ExceptionType t) {
        return SEVERITY.getOrDefault(t, ExceptionSeverity.INFO);
    }

    /** Exposed for the dashboard service to seed an ordered, zero-filled map. */
    public Map<ExceptionType, Integer> emptyCounts() {
        Map<ExceptionType, Integer> m = new LinkedHashMap<>();
        for (ExceptionType t : ExceptionType.values()) m.put(t, 0);
        return m;
    }
}
