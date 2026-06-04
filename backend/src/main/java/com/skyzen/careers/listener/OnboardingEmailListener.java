package com.skyzen.careers.listener;

import com.skyzen.careers.event.InternActivatedEvent;
import com.skyzen.careers.event.OnboardingAcceptedEvent;
import com.skyzen.careers.event.OnboardingAssignedEvent;
import com.skyzen.careers.event.OnboardingItemReviewedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Phase 4 onboarding email fan-out — all best-effort, all AFTER_COMMIT.
 * Phase 7 will replace these log-line stubs with real
 * {@code NotificationService} calls and {@code SentNotification} rows. For
 * Phase 4 the lifecycle transitions themselves are what drive the dashboard
 * mode + stepper changes; emails are nice-to-have.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OnboardingEmailListener {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAssigned(OnboardingAssignedEvent e) {
        log.info("[OnboardingEmail] assigned packet={} user={} — TODO Phase 7 fan-out",
                e.getPacketId(), e.getApplicantUserId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onItemReviewed(OnboardingItemReviewedEvent e) {
        log.info("[OnboardingEmail] item={} user={} category={} decision={} — TODO Phase 7",
                e.getItemId(), e.getApplicantUserId(), e.getCategory(), e.getDecision());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAccepted(OnboardingAcceptedEvent e) {
        log.info("[OnboardingEmail] packet={} user={} ACCEPTED — TODO Phase 7 welcome",
                e.getPacketId(), e.getApplicantUserId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onActivated(InternActivatedEvent e) {
        log.info("[OnboardingEmail] user={} ACTIVE_INTERN — TODO Phase 7 activation email",
                e.getUserId());
    }
}
