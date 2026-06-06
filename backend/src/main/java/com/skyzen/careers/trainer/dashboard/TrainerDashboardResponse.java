package com.skyzen.careers.trainer.dashboard;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Trainer Phase 1 — Home dashboard response. Single call returns the
 * 6 KPI snapshots, today's meetings, recent activity, and unread
 * notification count. Mirrors the ERM dashboard shape for frontend
 * consistency.
 */
public record TrainerDashboardResponse(
        Caller caller,
        Instant asOf,
        Map<TrainerKpiKey, KpiSnapshot> kpis,
        List<TodayMeetingRow> todayMeetings,
        List<RecentActivityRow> recentActivity,
        long unreadNotifications
) {

    public record Caller(String firstName, String lastName, String role) {}

    public record KpiSnapshot(
            TrainerKpiKey key,
            String label,
            long count,
            long urgentCount,
            String helperText,
            String actionUrl
    ) {}

    public record TodayMeetingRow(
            UUID meetingId,
            UUID internLifecycleId,
            String internName,
            Instant scheduledFor,
            Integer durationMinutes,
            String topic,
            /** Host link — present only when caller hosts the meeting. */
            String zoomStartUrl,
            String zoomJoinUrl
    ) {}

    public record RecentActivityRow(
            Instant at,
            String entityType,
            UUID entityId,
            String action,
            UUID actorUserId,
            String actorName,
            UUID subjectUserId,
            String subjectName,
            String deepLink
    ) {}
}
