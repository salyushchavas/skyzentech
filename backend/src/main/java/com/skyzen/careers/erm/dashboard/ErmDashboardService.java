package com.skyzen.careers.erm.dashboard;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.erm.exception.ExceptionDetectionResult;
import com.skyzen.careers.erm.exception.ExceptionDetectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Phase 1 — read-only ERM Home dashboard service.
 *
 * <h2>Query budget</h2>
 * Total: ~11 queries per cold call (8 KPI counts + 1 exceptions union +
 * 1 recent-activity feed + 1 unread-notifications count). Cache TTL 30s
 * keyed by {@code (callerId, scope)} keeps hot paths under 10ms.
 *
 * <h2>Cache</h2>
 * In-process {@link ConcurrentHashMap}, no eviction beyond the 30s
 * staleness check. Explicit invalidation via
 * {@link #invalidate(UUID, ErmScope)} — called from
 * {@code POST /api/v1/erm/dashboard/refresh}. Phase 6 events can also
 * call this on relevant state changes without changing the data shape.
 *
 * <h2>Scope</h2>
 * {@link ErmScope#MINE} filters by {@code intern_lifecycles.erm_id = caller}
 * and also picks up unassigned applications ({@code erm_owner_id IS NULL})
 * so ERM sees the queue waiting to be claimed. {@link ErmScope#ALL} is
 * system-wide (still subject to org boundaries when multi-tenant lands).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ErmDashboardService {

    private static final Duration CACHE_TTL = Duration.ofSeconds(30);
    private static final int RECENT_ACTIVITY_LIMIT = 10;

    private final JdbcTemplate jdbc;
    private final ExceptionDetectionService exceptionDetectionService;

    private record CacheKey(UUID callerId, ErmScope scope) {}
    private record CacheEntry(ErmDashboardResponse value, Instant cachedAt) {}

    private final Map<CacheKey, CacheEntry> cache = new ConcurrentHashMap<>();

    public ErmDashboardResponse getDashboard(User caller, ErmScope scope) {
        if (caller == null) {
            throw new IllegalArgumentException("caller is required");
        }
        ErmScope effectiveScope = scope != null ? scope : ErmScope.MINE;
        CacheKey key = new CacheKey(caller.getId(), effectiveScope);
        CacheEntry existing = cache.get(key);
        Instant now = Instant.now();
        if (existing != null
                && Duration.between(existing.cachedAt(), now).compareTo(CACHE_TTL) < 0) {
            return existing.value();
        }
        ErmDashboardResponse fresh = build(caller, effectiveScope, now);
        cache.put(key, new CacheEntry(fresh, now));
        return fresh;
    }

    public void invalidate(UUID callerId, ErmScope scope) {
        if (callerId == null) return;
        if (scope != null) {
            cache.remove(new CacheKey(callerId, scope));
        } else {
            for (ErmScope s : ErmScope.values()) {
                cache.remove(new CacheKey(callerId, s));
            }
        }
    }

    // ── Assembly ───────────────────────────────────────────────────────────

    private ErmDashboardResponse build(User caller, ErmScope scope, Instant now) {
        Map<ErmKpiKey, KpiSnapshot> kpis = computeKpis(caller, scope, now);
        ExceptionDetectionResult exceptions = exceptionDetectionService.detect(scope, caller.getId());
        List<ErmDashboardResponse.ActivityEntry> activity = recentActivity(caller, scope);
        long unread = unreadNotifications(caller);

        ErmDashboardResponse.Caller callerDto = new ErmDashboardResponse.Caller(
                firstName(caller),
                lastName(caller),
                primaryRole(caller));

        return new ErmDashboardResponse(
                callerDto,
                now,
                scope.wireValue(),
                kpis,
                new ErmDashboardResponse.ExceptionSummary(
                        exceptions.counts(), exceptions.topUrgent()),
                activity,
                unread);
    }

    // ── KPI queries ───────────────────────────────────────────────────────

    private Map<ErmKpiKey, KpiSnapshot> computeKpis(User caller, ErmScope scope, Instant now) {
        Map<ErmKpiKey, KpiSnapshot> out = new LinkedHashMap<>();
        boolean mine = scope == ErmScope.MINE;
        UUID callerId = caller.getId();

        out.put(ErmKpiKey.APPLICATIONS_PENDING_REVIEW,
                applicationsPendingReview(mine, callerId));
        out.put(ErmKpiKey.INTERVIEWS_TODAY,
                interviewsToday(mine, callerId, now));
        out.put(ErmKpiKey.OFFERS_PENDING_SIGNATURE,
                offersPendingSignature(mine, callerId));
        out.put(ErmKpiKey.ONBOARDING_OVERDUE,
                onboardingOverdue(mine, callerId));
        out.put(ErmKpiKey.I9_EVERIFY_DUE,
                i9EverifyDue(mine, callerId));
        out.put(ErmKpiKey.ACTIVE_INTERNS_WITHOUT_PROJECT,
                activeInternsWithoutProject(mine, callerId));
        out.put(ErmKpiKey.EVALUATIONS_OVERDUE,
                evaluationsOverdue(mine, callerId));
        out.put(ErmKpiKey.TIMESHEETS_PENDING_APPROVAL,
                timesheetsPendingApproval(mine, callerId));
        return out;
    }

    private KpiSnapshot applicationsPendingReview(boolean mine, UUID callerId) {
        String base = "FROM applications WHERE status = 'APPLIED'";
        String mineClause = mine
                ? " AND (erm_owner_id IS NULL OR erm_owner_id = ?)" : "";
        long total = countWithOptionalCaller(base + mineClause, mine, callerId);
        long urgent = countWithOptionalCaller(
                base + mineClause
                        + " AND applied_at < NOW() - INTERVAL '"
                        + ErmThresholds.APPLICATION_OVERDUE_DAYS + " days'",
                mine, callerId);
        return new KpiSnapshot(
                ErmKpiKey.APPLICATIONS_PENDING_REVIEW,
                "Applications pending review",
                total,
                urgent,
                urgent > 0
                        ? urgent + " waiting more than " + ErmThresholds.APPLICATION_OVERDUE_DAYS + " days"
                        : null,
                "/careers/erm/applications");
    }

    private KpiSnapshot interviewsToday(boolean mine, UUID callerId, Instant now) {
        LocalDate today = now.atZone(ZoneOffset.UTC).toLocalDate();
        Instant startOfDay = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant startOfTomorrow = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        StringBuilder sql = new StringBuilder()
                .append("FROM interviews i ")
                .append("JOIN applications a ON a.id = i.application_id ")
                .append("WHERE i.status = 'SCHEDULED' ")
                .append("  AND i.scheduled_at >= ? AND i.scheduled_at < ? ");
        List<Object> params = new ArrayList<>();
        params.add(java.sql.Timestamp.from(startOfDay));
        params.add(java.sql.Timestamp.from(startOfTomorrow));
        if (mine) {
            sql.append(" AND (a.erm_owner_id = ? OR i.interviewer_id = ? OR i.created_by = ?)");
            params.add(callerId); params.add(callerId); params.add(callerId);
        }
        long total = countWithParams(sql.toString(), params);
        return new KpiSnapshot(
                ErmKpiKey.INTERVIEWS_TODAY,
                "Interviews today",
                total,
                total > 0 ? total : 0,
                total == 0 ? "Quiet day" : null,
                "/careers/erm/interviews");
    }

    private KpiSnapshot offersPendingSignature(boolean mine, UUID callerId) {
        String base = "FROM offers WHERE status = 'SENT'";
        String mineClause = mine ? " AND created_by = ?" : "";
        long total = countWithOptionalCaller(base + mineClause, mine, callerId);
        long urgent = countWithOptionalCaller(
                base + mineClause
                        + " AND expires_at IS NOT NULL "
                        + " AND expires_at < NOW() + INTERVAL '"
                        + ErmThresholds.OFFER_EXPIRY_URGENT_HOURS + " hours'",
                mine, callerId);
        return new KpiSnapshot(
                ErmKpiKey.OFFERS_PENDING_SIGNATURE,
                "Offers pending signature",
                total,
                urgent,
                urgent > 0
                        ? urgent + " expiring within "
                                + ErmThresholds.OFFER_EXPIRY_URGENT_HOURS + "h"
                        : null,
                "/careers/erm/offers");
    }

    private KpiSnapshot onboardingOverdue(boolean mine, UUID callerId) {
        String base = "FROM onboarding_packets WHERE status IN ('ASSIGNED','IN_PROGRESS')"
                + " AND assigned_at < NOW() - INTERVAL '"
                + ErmThresholds.ONBOARDING_OVERDUE_DAYS + " days'";
        String mineClause = mine ? " AND assigned_by_id = ?" : "";
        long total = countWithOptionalCaller(base + mineClause, mine, callerId);
        long urgent = countWithOptionalCaller(
                "FROM onboarding_packets WHERE status IN ('ASSIGNED','IN_PROGRESS')"
                        + " AND assigned_at < NOW() - INTERVAL '"
                        + ErmThresholds.ONBOARDING_URGENT_DAYS + " days'"
                        + mineClause,
                mine, callerId);
        return new KpiSnapshot(
                ErmKpiKey.ONBOARDING_OVERDUE,
                "Onboarding overdue",
                total,
                urgent,
                urgent > 0
                        ? urgent + " past " + ErmThresholds.ONBOARDING_URGENT_DAYS + " days"
                        : null,
                "/careers/erm/onboarding");
    }

    private KpiSnapshot i9EverifyDue(boolean mine, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("FROM i9_forms f ")
                .append("JOIN candidates c ON c.id = f.candidate_id ")
                .append("JOIN intern_lifecycles il ON il.user_id = c.user_id ")
                .append("WHERE il.active_status = 'ACTIVE' ")
                .append("  AND f.first_day_of_employment IS NOT NULL ")
                .append("  AND f.first_day_of_employment + INTERVAL '")
                .append(ErmThresholds.I9_EVERIFY_OVERDUE_DAYS).append(" days' < CURRENT_DATE ")
                .append("  AND ( f.status <> 'COMPLETED' ")
                .append("        OR NOT EXISTS (SELECT 1 FROM everify_cases ec ")
                .append("                         WHERE ec.i9_form_id = f.id ")
                .append("                           AND ec.status = 'EMPLOYMENT_AUTHORIZED') ) ");
        List<Object> params = new ArrayList<>();
        if (mine) { sql.append(" AND il.erm_id = ?"); params.add(callerId); }
        long total = countWithParams(sql.toString(), params);
        return new KpiSnapshot(
                ErmKpiKey.I9_EVERIFY_DUE,
                "I-9 / E-Verify due",
                total,
                total,
                total > 0 ? "All past the federal 3-business-day window" : null,
                "/careers/erm/compliance");
    }

    private KpiSnapshot activeInternsWithoutProject(boolean mine, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("FROM intern_lifecycles il ")
                .append("WHERE il.active_status = 'ACTIVE' ")
                .append("  AND NOT EXISTS (SELECT 1 FROM project_assignments pa ")
                .append("                    WHERE pa.intern_id = il.user_id ")
                .append("                      AND pa.status NOT IN ('COMPLETED','RETURNED','CANCELLED')) ");
        List<Object> params = new ArrayList<>();
        if (mine) { sql.append(" AND il.erm_id = ?"); params.add(callerId); }
        long total = countWithParams(sql.toString(), params);
        long urgent = countWithParams(
                sql.toString() + " AND il.started_at < NOW() - INTERVAL '"
                        + ErmThresholds.NO_PROJECT_OVERDUE_DAYS + " days'",
                params);
        return new KpiSnapshot(
                ErmKpiKey.ACTIVE_INTERNS_WITHOUT_PROJECT,
                "Active interns without project",
                total,
                urgent,
                urgent > 0
                        ? urgent + " past " + ErmThresholds.NO_PROJECT_OVERDUE_DAYS + " days"
                        : null,
                "/careers/erm/active-interns");
    }

    private KpiSnapshot evaluationsOverdue(boolean mine, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("FROM intern_lifecycles il ")
                .append("LEFT JOIN ( ")
                .append("  SELECT intern_lifecycle_id, MAX(published_at) AS published_at ")
                .append("    FROM intern_evaluations ")
                .append("   WHERE evaluation_type = 'MONTHLY' ")
                .append("     AND status IN ('PUBLISHED','ACKNOWLEDGED','AMENDED') ")
                .append("   GROUP BY intern_lifecycle_id ")
                .append(") maxEval ON maxEval.intern_lifecycle_id = il.id ")
                .append("WHERE il.active_status = 'ACTIVE' ")
                .append("  AND il.started_at IS NOT NULL ")
                .append("  AND COALESCE(maxEval.published_at, il.started_at) < NOW() - INTERVAL '")
                .append(ErmThresholds.EVAL_OVERDUE_DAYS).append(" days' ");
        List<Object> params = new ArrayList<>();
        if (mine) { sql.append(" AND il.erm_id = ?"); params.add(callerId); }
        long total = countWithParams(sql.toString(), params);
        return new KpiSnapshot(
                ErmKpiKey.EVALUATIONS_OVERDUE,
                "Evaluations overdue",
                total,
                total,
                total > 0
                        ? "Last MONTHLY > " + ErmThresholds.EVAL_OVERDUE_DAYS + " days ago"
                        : null,
                "/careers/erm/active-interns?filter=eval-overdue");
    }

    private KpiSnapshot timesheetsPendingApproval(boolean mine, UUID callerId) {
        StringBuilder sql = new StringBuilder()
                .append("FROM timesheets t ")
                .append("JOIN intern_lifecycles il ON il.user_id = t.intern_id ")
                .append("WHERE t.status = 'SUBMITTED' ");
        List<Object> params = new ArrayList<>();
        if (mine) {
            sql.append(" AND (il.erm_id = ? OR il.evaluator_id = ?)");
            params.add(callerId); params.add(callerId);
        }
        long total = countWithParams(sql.toString(), params);
        return new KpiSnapshot(
                ErmKpiKey.TIMESHEETS_PENDING_APPROVAL,
                "Timesheets pending approval",
                total,
                total,
                null,
                "/careers/erm/timesheets");
    }

    // ── Recent activity + unread notifications ────────────────────────────

    private List<ErmDashboardResponse.ActivityEntry> recentActivity(User caller, ErmScope scope) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT al.action, al.entity_type, al.entity_id, al.timestamp, ")
                .append("       actor.full_name AS actor_name, subj.full_name AS subject_name ")
                .append("  FROM audit_logs al ")
                .append("  LEFT JOIN users actor ON actor.id = al.user_id ")
                .append("  LEFT JOIN users subj  ON subj.id = al.subject_user_id ");
        List<Object> params = new ArrayList<>();
        if (scope == ErmScope.MINE) {
            sql.append(" WHERE al.subject_user_id IN ( ")
               .append("   SELECT user_id FROM intern_lifecycles WHERE erm_id = ? ")
               .append(" ) ");
            params.add(caller.getId());
        }
        sql.append(" ORDER BY al.timestamp DESC LIMIT ").append(RECENT_ACTIVITY_LIMIT);
        try {
            return jdbc.query(sql.toString(), params.toArray(), (rs, n) ->
                    new ErmDashboardResponse.ActivityEntry(
                            rs.getString("actor_name"),
                            rs.getString("action"),
                            rs.getString("subject_name"),
                            rs.getTimestamp("timestamp") != null
                                    ? rs.getTimestamp("timestamp").toInstant()
                                    : null,
                            "/careers/erm"));
        } catch (Exception e) {
            log.warn("[ErmDashboard] recent activity failed (non-fatal): {}", e.getMessage());
            return List.of();
        }
    }

    private long unreadNotifications(User caller) {
        try {
            Long v = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM user_notifications "
                            + "WHERE recipient_user_id = ? AND read_at IS NULL",
                    Long.class, caller.getId());
            return v != null ? v : 0L;
        } catch (Exception e) {
            log.warn("[ErmDashboard] unread count failed (non-fatal): {}", e.getMessage());
            return 0L;
        }
    }

    // ── Count helpers ─────────────────────────────────────────────────────

    private long countWithOptionalCaller(String fromAndWhere, boolean withCaller, UUID callerId) {
        String sql = "SELECT COUNT(*) " + fromAndWhere;
        try {
            Long v = withCaller
                    ? jdbc.queryForObject(sql, Long.class, callerId)
                    : jdbc.queryForObject(sql, Long.class);
            return v != null ? v : 0L;
        } catch (Exception e) {
            log.warn("[ErmDashboard] count query failed (non-fatal): {} -- sql: {}",
                    e.getMessage(), sql);
            return 0L;
        }
    }

    private long countWithParams(String fromAndWhere, List<Object> params) {
        String sql = "SELECT COUNT(*) " + fromAndWhere;
        try {
            Long v = jdbc.queryForObject(sql, Long.class, params.toArray());
            return v != null ? v : 0L;
        } catch (Exception e) {
            log.warn("[ErmDashboard] count query failed (non-fatal): {} -- sql: {}",
                    e.getMessage(), sql);
            return 0L;
        }
    }

    // ── Caller naming ─────────────────────────────────────────────────────

    private static String firstName(User u) {
        String full = u.getFullName();
        if (full == null || full.isBlank()) return "";
        return full.trim().split("\\s+", 2)[0];
    }

    private static String lastName(User u) {
        String full = u.getFullName();
        if (full == null || full.isBlank()) return "";
        String[] parts = full.trim().split("\\s+", 2);
        return parts.length > 1 ? parts[1] : "";
    }

    private static String primaryRole(User u) {
        if (u.getRoles() == null || u.getRoles().isEmpty()) return "ERM";
        if (u.getRoles().contains(UserRole.SUPER_ADMIN)) return "SUPER_ADMIN";
        if (u.getRoles().contains(UserRole.ERM)) return "ERM";
        return u.getRoles().iterator().next().name();
    }
}
