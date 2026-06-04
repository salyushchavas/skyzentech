package com.skyzen.careers.listener;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.event.InternActivatedEvent;
import com.skyzen.careers.event.OnboardingAcceptedEvent;
import com.skyzen.careers.event.OnboardingAssignedEvent;
import com.skyzen.careers.event.OnboardingItemReviewedEvent;
import com.skyzen.careers.notification.UserNotificationDispatcher;
import com.skyzen.careers.repository.InternLifecycleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.UUID;

/**
 * Phase 4 onboarding fan-out — all best-effort, all AFTER_COMMIT. The
 * Phase 7 sweep wires the {@link UserNotificationDispatcher} so the
 * bell + Messages page surface the same lifecycle events that the doc
 * §9 matrix calls out (applicant + ERM per intern_lifecycles). Email is
 * still TODO for these specific events — the in-app row is what the
 * matrix asks for here.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OnboardingEmailListener {

    private static final String INTERN_DASH = "/careers/intern";
    private static final String ERM_DASH = "/careers/erm";

    private final UserNotificationDispatcher dispatcher;
    private final InternLifecycleRepository lifecycleRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAssigned(OnboardingAssignedEvent e) {
        log.info("[OnboardingEmail] assigned packet={} user={}",
                e.getPacketId(), e.getApplicantUserId());
        dispatchApplicantAndErm(e.getApplicantUserId(),
                "ONBOARDING_ASSIGNED",
                "Your onboarding packet is ready",
                "Open Onboarding to review and complete the assigned items.",
                INTERN_DASH + "/onboarding",
                "Onboarding packet assigned",
                "An onboarding packet was assigned to the intern.");
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onItemReviewed(OnboardingItemReviewedEvent e) {
        log.info("[OnboardingEmail] item={} user={} category={} decision={}",
                e.getItemId(), e.getApplicantUserId(), e.getCategory(), e.getDecision());
        String decision = e.getDecision() != null ? e.getDecision() : "REVIEWED";
        String title;
        String body;
        switch (decision) {
            case "ACCEPT" -> {
                title = "Onboarding item accepted";
                body = "Your " + nz(e.getCategory()) + " item was accepted.";
            }
            case "REJECT" -> {
                title = "Onboarding item rejected";
                body = "Your " + nz(e.getCategory()) + " item was rejected. "
                        + "Open onboarding for reviewer notes.";
            }
            case "RESEND" -> {
                title = "Onboarding item: please resubmit";
                body = "Reviewer asked you to resubmit the " + nz(e.getCategory()) + " item.";
            }
            default -> {
                title = "Onboarding item reviewed";
                body = "Your " + nz(e.getCategory()) + " item was reviewed.";
            }
        }
        dispatchApplicantAndErm(e.getApplicantUserId(),
                "ONBOARDING_ITEM_REVIEWED",
                title, body,
                INTERN_DASH + "/onboarding/" + e.getItemId(),
                "Onboarding item " + decision.toLowerCase(),
                "An onboarding item was " + decision.toLowerCase() + ".");
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAccepted(OnboardingAcceptedEvent e) {
        log.info("[OnboardingEmail] packet={} user={} ACCEPTED",
                e.getPacketId(), e.getApplicantUserId());
        dispatchApplicantAndErm(e.getApplicantUserId(),
                "ONBOARDING_ACCEPTED",
                "Onboarding accepted",
                "All onboarding items were accepted. You're cleared for activation.",
                INTERN_DASH + "/onboarding",
                "Onboarding accepted",
                "All onboarding items were accepted.");
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onActivated(InternActivatedEvent e) {
        log.info("[OnboardingEmail] user={} ACTIVE_INTERN", e.getUserId());
        dispatchApplicantAndErm(e.getUserId(),
                "INTERN_ACTIVATED",
                "You're now an active intern",
                "Your engagement is active. Projects and weekly cycle begin here.",
                INTERN_DASH,
                "Intern activated",
                "Intern engagement moved to ACTIVE_INTERN.");
    }

    private void dispatchApplicantAndErm(UUID applicantUserId, String eventType,
                                          String internTitle, String internBody,
                                          String internActionUrl,
                                          String ermTitle, String ermBody) {
        if (applicantUserId == null) return;
        try {
            dispatcher.dispatch(applicantUserId, eventType, applicantUserId,
                    internTitle, internBody, internActionUrl, false);
        } catch (Exception ex) {
            log.debug("[OnboardingEmail] applicant dispatch failed for {}: {}",
                    eventType, ex.getMessage());
        }
        InternLifecycle lc;
        try {
            lc = lifecycleRepository.findByUserId(applicantUserId).orElse(null);
        } catch (Exception ex) {
            log.debug("[OnboardingEmail] lifecycle lookup failed for {}: {}",
                    applicantUserId, ex.getMessage());
            return;
        }
        if (lc == null || lc.getErmId() == null) {
            log.debug("[OnboardingEmail] {} ERM slot null for {} — skip", eventType, applicantUserId);
            return;
        }
        try {
            dispatcher.dispatch(lc.getErmId(), eventType, applicantUserId,
                    ermTitle, ermBody, ERM_DASH, false);
        } catch (Exception ex) {
            log.debug("[OnboardingEmail] ERM dispatch failed for {}: {}",
                    eventType, ex.getMessage());
        }
    }

    private static String nz(String s) {
        return s != null ? s : "";
    }
}
