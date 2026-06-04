package com.skyzen.careers.erm.dashboard;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.erm.exception.ExceptionDetectionResult;
import com.skyzen.careers.erm.exception.ExceptionDetectionService;
import com.skyzen.careers.erm.exception.ExceptionSeverity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Phase 1 — ERM right-side panel. Returns 8 quick-action shortcuts with
 * contextual badge counts so ERM sees "what's waiting on me" without
 * leaving the current page. Polled at 60s by the frontend; cache-free
 * (counts must be live for the badges to feel responsive).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ErmRightPanelService {

    private final JdbcTemplate jdbc;
    private final ExceptionDetectionService exceptionDetectionService;

    public ErmRightPanelResponse build(User caller) {
        UUID callerId = caller.getId();
        Instant now = Instant.now();

        long appsPendingReview = safeCount(
                "SELECT COUNT(*) FROM applications "
                        + "WHERE status = 'APPLIED' "
                        + "  AND (erm_owner_id IS NULL OR erm_owner_id = ?)",
                callerId);

        long shortlistedNeedingInterview = safeCount(
                "SELECT COUNT(*) FROM applications a "
                        + "WHERE a.status = 'SHORTLISTED' "
                        + "  AND NOT EXISTS (SELECT 1 FROM interviews i "
                        + "                    WHERE i.application_id = a.id "
                        + "                      AND i.status = 'SCHEDULED') "
                        + "  AND (a.erm_owner_id IS NULL OR a.erm_owner_id = ?)",
                callerId);

        long selectedWithoutOffer = safeCount(
                "SELECT COUNT(*) FROM applications a "
                        + "WHERE a.status IN ('INTERVIEWED','SELECTED_CONDITIONAL') "
                        + "  AND NOT EXISTS (SELECT 1 FROM offers o "
                        + "                    WHERE o.application_id = a.id "
                        + "                      AND o.status <> 'VOIDED') "
                        + "  AND (a.erm_owner_id IS NULL OR a.erm_owner_id = ?)",
                callerId);

        long newHireWithoutPacket = safeCount(
                "SELECT COUNT(*) FROM users u "
                        + "JOIN intern_lifecycles il ON il.user_id = u.id "
                        + "WHERE u.lifecycle_status IN ('EMPLOYEE_ID_CREATED','ONBOARDING_ASSIGNED') "
                        + "  AND NOT EXISTS (SELECT 1 FROM onboarding_packets pk "
                        + "                    WHERE pk.intern_lifecycle_id = il.id) "
                        + "  AND (il.erm_id IS NULL OR il.erm_id = ?)",
                callerId);

        long docsAwaitingReview = safeCount(
                "SELECT COUNT(*) FROM onboarding_items oi "
                        + "JOIN onboarding_packets pk ON pk.id = oi.packet_id "
                        + "JOIN intern_lifecycles il ON il.id = pk.intern_lifecycle_id "
                        + "WHERE oi.status = 'SUBMITTED' "
                        + "  AND (il.erm_id IS NULL OR il.erm_id = ?)",
                callerId);

        long exitChecklistOpen = safeCount(
                "SELECT COUNT(*) FROM exit_records er "
                        + "JOIN intern_lifecycles il ON il.id = er.intern_lifecycle_id "
                        + "WHERE (er.access_revocation_done = FALSE "
                        + "       OR er.final_documents_archived = FALSE) "
                        + "  AND il.erm_id = ?",
                callerId);

        ExceptionDetectionResult exceptions =
                exceptionDetectionService.detect(ErmScope.MINE, callerId);
        long urgentExceptionCount = exceptions.counts().entrySet().stream()
                .filter(e -> exceptionDetectionService.severityOf(e.getKey())
                        == ExceptionSeverity.URGENT)
                .mapToLong(e -> e.getValue() != null ? e.getValue() : 0L)
                .sum();

        long todayInterviews = todayInterviewsCount(callerId, now);
        long unreadNotifications = safeCount(
                "SELECT COUNT(*) FROM user_notifications "
                        + "WHERE recipient_user_id = ? AND read_at IS NULL",
                callerId);

        List<ErmRightPanelResponse.QuickAction> actions = new ArrayList<>();
        actions.add(qa("shortlist",
                "Review applications",
                "/careers/erm/applications?status=APPLIED",
                appsPendingReview));
        actions.add(qa("interview",
                "Schedule interview",
                "/careers/erm/shortlist",
                shortlistedNeedingInterview));
        actions.add(qa("offer",
                "Send offer",
                "/careers/erm/interviews?decision=SELECTED",
                selectedWithoutOffer));
        actions.add(qa("onboarding-assign",
                "Assign onboarding",
                "/careers/erm/new-hire",
                newHireWithoutPacket));
        actions.add(qa("doc-review",
                "Review documents",
                "/careers/erm/onboarding",
                docsAwaitingReview));
        actions.add(qa("escalate",
                "Open escalations",
                "/careers/erm/escalations",
                urgentExceptionCount));
        actions.add(qa("exit",
                "Exit checklist",
                "/careers/erm/exits",
                exitChecklistOpen));
        // ERM Phase 2 — Hold follow-up. Counts applications on HOLD; ERM uses
        // this queue to revisit paused candidates without leaving the inbox.
        long holdCount = safeCount(
                "SELECT COUNT(*) FROM applications "
                        + "WHERE status = 'HOLD' "
                        + "  AND (erm_owner_id IS NULL OR erm_owner_id = ?)",
                callerId);
        actions.add(qa("hold-followup",
                "Hold queue",
                "/careers/erm/applications?stage=HOLD",
                holdCount));
        actions.add(qa("reports",
                "Export report",
                "/careers/erm/reports",
                0L));

        return new ErmRightPanelResponse(actions, unreadNotifications, todayInterviews);
    }

    private long todayInterviewsCount(UUID callerId, Instant now) {
        LocalDate today = now.atZone(ZoneOffset.UTC).toLocalDate();
        Instant startOfDay = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant startOfTomorrow = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        try {
            Long v = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM interviews i "
                            + "JOIN applications a ON a.id = i.application_id "
                            + "WHERE i.status = 'SCHEDULED' "
                            + "  AND i.scheduled_at >= ? AND i.scheduled_at < ? "
                            + "  AND (a.erm_owner_id IS NULL OR a.erm_owner_id = ? OR i.interviewer_id = ?)",
                    Long.class,
                    java.sql.Timestamp.from(startOfDay),
                    java.sql.Timestamp.from(startOfTomorrow),
                    callerId, callerId);
            return v != null ? v : 0L;
        } catch (Exception e) {
            log.warn("[ErmRightPanel] today-interviews count failed (non-fatal): {}",
                    e.getMessage());
            return 0L;
        }
    }

    private long safeCount(String sql, Object... params) {
        try {
            Long v = jdbc.queryForObject(sql, Long.class, params);
            return v != null ? v : 0L;
        } catch (Exception e) {
            log.warn("[ErmRightPanel] count failed (non-fatal): {} -- {}",
                    e.getMessage(), sql);
            return 0L;
        }
    }

    private static ErmRightPanelResponse.QuickAction qa(String key, String label,
                                                         String href, long badge) {
        return new ErmRightPanelResponse.QuickAction(key, label, href, badge);
    }
}
