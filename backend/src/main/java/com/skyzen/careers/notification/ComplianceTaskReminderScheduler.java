package com.skyzen.careers.notification;

import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Evaluation;
import com.skyzen.careers.entity.MaterialAcknowledgement;
import com.skyzen.careers.entity.OnboardingTask;
import com.skyzen.careers.entity.Timesheet;
import com.skyzen.careers.entity.WeeklyMaterial;
import com.skyzen.careers.entity.WeeklyReport;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.WeeklyReportStatus;
import com.skyzen.careers.enums.TimesheetStatus;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.EvaluationRepository;
import com.skyzen.careers.repository.MaterialAcknowledgementRepository;
import com.skyzen.careers.repository.OnboardingTaskRepository;
import com.skyzen.careers.repository.TimesheetRepository;
import com.skyzen.careers.repository.WeeklyMaterialRepository;
import com.skyzen.careers.repository.WeeklyReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Daily scan for ALL "I'm still pending" cycle reminders. Started life in
 * batch-2 as a compliance-task-only reminder; batch-3 extended it into a
 * single daily pass that emits five additional signal types — material
 * unread, weekly-report due, timesheet due, evaluation due (supervisor), and
 * I-983 self-evaluation due (intern). One scheduler, one cron, six passes.
 *
 * <p><b>Idempotency:</b> every pass routes through {@link NotificationService}
 * which checks the sent_notifications ledger before sending. Weekly events
 * use deterministic synthetic UUIDs encoding the period so each
 * (resource × intern × week) tuple emails at most once.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ComplianceTaskReminderScheduler {

    /** A material is "still unread" only after this many days have passed since release. */
    private static final long MATERIAL_UNREAD_GRACE_DAYS = 3L;

    /** A material is no longer in the unread-reminder window after this many days. */
    private static final long MATERIAL_UNREAD_WINDOW_DAYS = 21L;

    /** A DRAFT evaluation needs a supervisor nudge after this many days. */
    private static final long EVALUATION_DRAFT_NUDGE_DAYS = 7L;

    private final OnboardingTaskRepository onboardingTaskRepository;
    private final WeeklyMaterialRepository weeklyMaterialRepository;
    private final MaterialAcknowledgementRepository materialAcknowledgementRepository;
    private final EngagementRepository engagementRepository;
    private final WeeklyReportRepository weeklyReportRepository;
    private final TimesheetRepository timesheetRepository;
    private final EvaluationRepository evaluationRepository;
    private final NotificationService notificationService;

    /**
     * How many days a task must be past its due date before we email the
     * intern. Set generous default (3 days) so a task missed on the due day
     * doesn't trigger an immediate "you're late" email at 12:01 AM.
     */
    @Value("${app.compliance.task-reminder.overdue-days:3}")
    private int overdueDays;

    /** 07:00 UTC every day. Runs after the work-auth pass at 06:00. */
    @Scheduled(cron = "0 0 7 * * *")
    public void fireDueReminders() {
        scanComplianceTasks();      // batch-2 (existing)
        scanMaterialUnread();       // batch-3
        scanWeeklyReportsDue();     // batch-3
        scanTimesheetsDue();        // batch-3
        scanEvaluationsDue();       // batch-3
        scanI983SelfEvalDue();      // batch-3
    }

    // ── Compliance tasks (existing, batch 2) ────────────────────────────────

    private void scanComplianceTasks() {
        LocalDate cutoff = LocalDate.now(ZoneOffset.UTC).minusDays(overdueDays);
        List<OnboardingTask> overdue;
        try {
            overdue = onboardingTaskRepository.findOverdueWithGraph(cutoff);
        } catch (Exception e) {
            log.warn("Compliance task scan failed (non-fatal): {}", e.getMessage());
            return;
        }
        if (overdue.isEmpty()) return;
        int sends = 0;
        for (OnboardingTask task : overdue) {
            try {
                notificationService.sendComplianceTaskReminder(task);
                sends++;
            } catch (Exception e) {
                log.warn("Compliance task reminder send failed for {} (non-fatal): {}",
                        task.getId(), e.getMessage());
            }
        }
        if (sends > 0) {
            log.info("Compliance task pass — attempted {} send(s) (cutoff={})", sends, cutoff);
        }
    }

    // ── Batch 3: material unread reminders ──────────────────────────────────

    /**
     * Released materials between {@code [today − WINDOW, today − GRACE)} days
     * ago that some intern in the audience hasn't acked yet.
     */
    private void scanMaterialUnread() {
        Instant now = Instant.now();
        Instant windowMin = now.minus(MATERIAL_UNREAD_WINDOW_DAYS, ChronoUnit.DAYS);
        Instant windowMax = now.minus(MATERIAL_UNREAD_GRACE_DAYS, ChronoUnit.DAYS);
        List<WeeklyMaterial> recent;
        try {
            recent = weeklyMaterialRepository.findReleasedBetween(windowMin, windowMax);
        } catch (Exception e) {
            log.warn("Material-unread scan failed (non-fatal): {}", e.getMessage());
            return;
        }
        if (recent.isEmpty()) return;

        // Resolve recipients on a per-material basis: scoped → just that
        // engagement's intern; broadcast → all ACTIVE engagements' interns.
        int sends = 0;
        for (WeeklyMaterial material : recent) {
            List<Candidate> audience = resolveAudience(material);
            for (Candidate intern : audience) {
                if (intern == null || intern.getId() == null) continue;
                boolean acked = materialAcknowledgementRepository
                        .findByMaterialIdAndInternId(material.getId(), intern.getId())
                        .isPresent();
                if (acked) continue;
                try {
                    notificationService.sendMaterialUnreadReminder(material, intern);
                    sends++;
                } catch (Exception e) {
                    log.warn("Material-unread reminder failed for material {} intern {} (non-fatal): {}",
                            material.getId(), intern.getId(), e.getMessage());
                }
            }
        }
        if (sends > 0) {
            log.info("Material-unread pass — attempted {} send(s)", sends);
        }
    }

    private List<Candidate> resolveAudience(WeeklyMaterial material) {
        if (material.getEngagement() != null) {
            Candidate c = material.getEngagement().getCandidate();
            return c != null ? List.of(c) : List.of();
        }
        return engagementRepository.findByStatus(EngagementStatus.ACTIVE).stream()
                .map(Engagement::getCandidate)
                .filter(c -> c != null && c.getUser() != null)
                .toList();
    }

    // ── Batch 3: weekly report + timesheet due reminders ────────────────────

    /**
     * Fri / Sat / Sun: nudge any active intern who hasn't submitted this
     * week's report yet (no row OR row still in DRAFT).
     */
    private void scanWeeklyReportsDue() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (!isEndOfWeek(today.getDayOfWeek())) return;
        LocalDate weekStart = mondayOf(today);

        int sends = 0;
        for (Engagement engagement : engagementRepository.findByStatus(EngagementStatus.ACTIVE)) {
            Candidate c = engagement.getCandidate();
            if (c == null) continue;
            try {
                WeeklyReport report = weeklyReportRepository
                        .findByInternIdAndWeekStart(c.getId(), weekStart).orElse(null);
                if (report == null || report.getStatus() == WeeklyReportStatus.DRAFT) {
                    notificationService.sendWeeklyReportDue(engagement, weekStart);
                    sends++;
                }
            } catch (Exception e) {
                log.warn("Weekly report due reminder failed for engagement {} (non-fatal): {}",
                        engagement.getId(), e.getMessage());
            }
        }
        if (sends > 0) {
            log.info("Weekly report due pass — attempted {} send(s) (weekStart={})", sends, weekStart);
        }
    }

    /** Same end-of-week gating as the report-due pass. */
    private void scanTimesheetsDue() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (!isEndOfWeek(today.getDayOfWeek())) return;
        LocalDate weekStart = mondayOf(today);

        int sends = 0;
        for (Engagement engagement : engagementRepository.findByStatus(EngagementStatus.ACTIVE)) {
            Candidate c = engagement.getCandidate();
            if (c == null) continue;
            try {
                Timesheet ts = timesheetRepository
                        .findByInternIdAndWeekStart(c.getId(), weekStart).orElse(null);
                if (ts == null || ts.getStatus() == TimesheetStatus.DRAFT) {
                    notificationService.sendTimesheetDue(engagement, weekStart);
                    sends++;
                }
            } catch (Exception e) {
                log.warn("Timesheet due reminder failed for engagement {} (non-fatal): {}",
                        engagement.getId(), e.getMessage());
            }
        }
        if (sends > 0) {
            log.info("Timesheet due pass — attempted {} send(s) (weekStart={})", sends, weekStart);
        }
    }

    // ── Batch 3: evaluation due (supervisor) + I-983 self-eval due (intern) ─

    private void scanEvaluationsDue() {
        Instant cutoff = Instant.now().minus(EVALUATION_DRAFT_NUDGE_DAYS, ChronoUnit.DAYS);
        List<Evaluation> stale;
        try {
            stale = evaluationRepository.findDraftsOlderThanWithGraph(cutoff);
        } catch (Exception e) {
            log.warn("Evaluation-due scan failed (non-fatal): {}", e.getMessage());
            return;
        }
        if (stale.isEmpty()) return;
        int sends = 0;
        for (Evaluation evaluation : stale) {
            try {
                long ageDays = ChronoUnit.DAYS.between(
                        evaluation.getCreatedAt() != null ? evaluation.getCreatedAt() : Instant.now(),
                        Instant.now());
                notificationService.sendEvaluationDue(evaluation, (int) ageDays);
                sends++;
            } catch (Exception e) {
                log.warn("Evaluation-due reminder failed for {} (non-fatal): {}",
                        evaluation.getId(), e.getMessage());
            }
        }
        if (sends > 0) {
            log.info("Evaluation-due pass — attempted {} send(s)", sends);
        }
    }

    private void scanI983SelfEvalDue() {
        List<Evaluation> drafts;
        try {
            drafts = evaluationRepository.findAllSelfReviewableDraftsWithGraph();
        } catch (Exception e) {
            log.warn("I-983 self-eval-due scan failed (non-fatal): {}", e.getMessage());
            return;
        }
        if (drafts.isEmpty()) return;
        int sends = 0;
        for (Evaluation evaluation : drafts) {
            try {
                notificationService.sendI983SelfEvalDue(evaluation);
                sends++;
            } catch (Exception e) {
                log.warn("I-983 self-eval reminder failed for {} (non-fatal): {}",
                        evaluation.getId(), e.getMessage());
            }
        }
        if (sends > 0) {
            log.info("I-983 self-eval-due pass — attempted {} send(s)", sends);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static boolean isEndOfWeek(DayOfWeek dow) {
        return dow == DayOfWeek.FRIDAY || dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY;
    }

    private static LocalDate mondayOf(LocalDate d) {
        int delta = d.getDayOfWeek().getValue() - DayOfWeek.MONDAY.getValue();
        return d.minusDays(delta < 0 ? delta + 7 : delta);
    }
}
