package com.skyzen.careers.service;

import com.skyzen.careers.entity.SentNotification;
import com.skyzen.careers.event.InterviewCompletedEvent;
import com.skyzen.careers.notification.NotificationEventType;
import com.skyzen.careers.repository.SentNotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.UUID;

/**
 * Change 4 — applicant-facing acknowledgment fired after an interview
 * scorecard finalizes.
 *
 * <p>One {@code sent_notifications} row per (interview, recipient) — the
 * unique constraint on {@code (event_type, target_id)} makes retries naturally
 * idempotent, so a scorecard re-submission (rare race) is safe.</p>
 *
 * <p>Best-effort end-to-end: listener failure logs without rolling back the
 * scorecard write (AFTER_COMMIT phase + own transaction).</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InterviewAcknowledgmentService {

    private final SentNotificationRepository sentNotificationRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onInterviewCompleted(InterviewCompletedEvent event) {
        if (event == null) return;
        UUID interviewId = event.getInterviewId();
        if (interviewId == null) return;
        String recipient = event.getCandidateEmail();
        if (recipient == null || recipient.isBlank()) {
            log.debug("Skipping INTERVIEW_COMPLETED ack — no recipient email for interview {}",
                    interviewId);
            return;
        }
        recordAck(interviewId, recipient);
    }

    /** Public for direct unit tests. */
    public void recordAck(java.util.UUID interviewId, String recipient) {
        if (sentNotificationRepository
                .existsByEventTypeAndTargetId(NotificationEventType.INTERVIEW_COMPLETED, interviewId)) {
            log.debug("INTERVIEW_COMPLETED already recorded for {}", interviewId);
            return;
        }
        try {
            sentNotificationRepository.save(SentNotification.builder()
                    .eventType(NotificationEventType.INTERVIEW_COMPLETED)
                    .targetId(interviewId)
                    .recipient(recipient)
                    .build());
            log.info("Recorded INTERVIEW_COMPLETED ack for {} -> {}", interviewId, recipient);
        } catch (DataIntegrityViolationException dive) {
            log.info("Duplicate INTERVIEW_COMPLETED ledger row for {} — already recorded.",
                    interviewId);
        } catch (Exception e) {
            log.warn("Failed to record INTERVIEW_COMPLETED for {} (non-fatal): {}",
                    interviewId, e.getMessage());
        }
    }
}
