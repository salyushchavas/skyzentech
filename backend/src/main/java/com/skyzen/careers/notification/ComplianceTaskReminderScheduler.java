package com.skyzen.careers.notification;

import com.skyzen.careers.entity.OnboardingTask;
import com.skyzen.careers.repository.OnboardingTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Daily scan for overdue onboarding / compliance tasks. Fires a single
 * reminder per overdue task (idempotency key {@code (event_type, task_id)}),
 * so a task that stays open for 30 days still emails the intern only once.
 *
 * <p><b>Cutoff:</b> a task qualifies when its {@code dueDate} is at least
 * {@code overdueDays} in the past (default 3). Configure via
 * {@code COMPLIANCE_TASK_REMINDER_OVERDUE_DAYS}.</p>
 *
 * <p>The {@link NotificationService} send pulls only the task title + due
 * date + days-overdue count — no SSN, no document numbers, no decrypted PII.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ComplianceTaskReminderScheduler {

    private final OnboardingTaskRepository onboardingTaskRepository;
    private final NotificationService notificationService;

    /**
     * How many days a task must be past its due date before we email the
     * intern. Set generous default (3 days) so a task missed on the due day
     * doesn't trigger an immediate "you're late" email at 12:01 AM.
     */
    @Value("${app.compliance.task-reminder.overdue-days:3}")
    private int overdueDays;

    /** 07:00 UTC every day — runs after the work-auth pass at 06:00. */
    @Scheduled(cron = "0 0 7 * * *")
    public void fireDueReminders() {
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
                // Idempotency lives in NotificationService — sending the same
                // task twice across runs is a no-op.
                notificationService.sendComplianceTaskReminder(task);
                sends++;
            } catch (Exception e) {
                log.warn("Compliance task reminder send failed for {} (non-fatal): {}",
                        task.getId(), e.getMessage());
            }
        }
        if (sends > 0) {
            log.info("Compliance task reminder pass — attempted {} send(s) (cutoff={})",
                    sends, cutoff);
        }
    }
}
