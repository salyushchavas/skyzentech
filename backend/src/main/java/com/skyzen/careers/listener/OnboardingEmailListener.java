package com.skyzen.careers.listener;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.OnboardingItem;
import com.skyzen.careers.entity.OnboardingPacket;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.erm.CommunicationTemplateService;
import com.skyzen.careers.event.InternActivatedEvent;
import com.skyzen.careers.event.OnboardingAcceptedEvent;
import com.skyzen.careers.event.OnboardingAssignedEvent;
import com.skyzen.careers.event.OnboardingItemReviewedEvent;
import com.skyzen.careers.notification.EmailProvider;
import com.skyzen.careers.notification.UserNotificationDispatcher;
import com.skyzen.careers.repository.I9FormRepository;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.OnboardingItemRepository;
import com.skyzen.careers.repository.OnboardingPacketRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.LinkedHashMap;
import java.util.Map;
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
    private final OnboardingItemRepository itemRepository;
    private final OnboardingPacketRepository packetRepository;
    private final UserRepository userRepository;
    private final I9FormRepository i9FormRepository;
    private final CommunicationTemplateService templateService;
    private final EmailProvider emailProvider;

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

        // ERM Phase 5 — render + send the template-driven applicant email
        // when ERM accepts/rejects/asks to resend an item.
        sendItemReviewedEmail(e, decision);
    }

    private void sendItemReviewedEmail(OnboardingItemReviewedEvent e, String decision) {
        if (e.getApplicantUserId() == null || e.getItemId() == null) return;
        try {
            User applicant = userRepository.findById(e.getApplicantUserId()).orElse(null);
            if (applicant == null || applicant.getEmail() == null) return;
            OnboardingItem item = itemRepository.findById(e.getItemId()).orElse(null);
            if (item == null) return;
            String templateKey = switch (decision) {
                case "ACCEPT" -> "ONBOARDING_ITEM_ACCEPTED";
                case "REJECT" -> "ONBOARDING_ITEM_REJECTED";
                case "RESEND" -> "ONBOARDING_ITEM_RESEND";
                default -> null;
            };
            if (templateKey == null) return;
            Map<String, Object> vars = new LinkedHashMap<>();
            vars.put("firstName", firstName(applicant));
            vars.put("documentName", categoryLabel(e.getCategory()));
            vars.put("ermComments", nz(item.getErmComments()));
            vars.put("ermName", ermName(item.getLastReviewedById()));
            renderAndSend(templateKey, vars, applicant);
        } catch (Exception ex) {
            log.warn("[OnboardingEmail] item-reviewed email failed: {}", ex.getMessage());
        }
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

        // ERM Phase 5 — packet-acceptance email
        try {
            if (e.getApplicantUserId() == null) return;
            User applicant = userRepository.findById(e.getApplicantUserId()).orElse(null);
            if (applicant == null || applicant.getEmail() == null) return;
            Map<String, Object> vars = new LinkedHashMap<>();
            vars.put("firstName", firstName(applicant));
            vars.put("firstDayOfEmployment", firstDayOfEmployment(e.getApplicantUserId()));
            renderAndSend("ONBOARDING_PACKET_ACCEPTED", vars, applicant);
        } catch (Exception ex) {
            log.warn("[OnboardingEmail] packet-accepted email failed: {}", ex.getMessage());
        }
    }

    private String firstDayOfEmployment(UUID userId) {
        try {
            OnboardingPacket pk = packetRepository.findByUserId(userId).orElse(null);
            if (pk == null) return "your scheduled start date";
            // We don't have a direct user-id → I-9 link, so resolve via candidate
            // table inside the I-9 repository's own graph. Soft-fail silently.
            return i9FormRepository.findAll().stream()
                    .filter(f -> f.getCandidate() != null
                            && f.getCandidate().getUser() != null
                            && userId.equals(f.getCandidate().getUser().getId()))
                    .findFirst()
                    .map(f -> f.getFirstDayOfEmployment() != null
                            ? f.getFirstDayOfEmployment().toString()
                            : "your scheduled start date")
                    .orElse("your scheduled start date");
        } catch (Exception e) {
            return "your scheduled start date";
        }
    }

    private void renderAndSend(String templateKey, Map<String, Object> vars, User recipient) {
        if (recipient == null || recipient.getEmail() == null) return;
        String subject = templateKey;
        String body = "";
        try {
            var rendered = templateService.render(templateKey, "EMAIL", vars).orElse(null);
            if (rendered != null) {
                subject = rendered.subject() != null ? rendered.subject() : templateKey;
                body = rendered.body() != null ? rendered.body() : "";
            } else {
                log.debug("[OnboardingEmail] template {} missing — skipping send", templateKey);
                return;
            }
        } catch (Exception e) {
            log.warn("[OnboardingEmail] render failed for {}: {}", templateKey, e.getMessage());
            return;
        }
        try {
            emailProvider.sendRendered(recipient.getEmail(), subject, body);
        } catch (Exception e) {
            log.warn("[OnboardingEmail] email send failed for {}: {}",
                    recipient.getEmail(), e.getMessage());
        }
    }

    private String ermName(UUID actorId) {
        if (actorId == null) return "Skyzen ERM";
        try {
            return userRepository.findById(actorId)
                    .map(u -> u.getFullName() != null ? u.getFullName() : "Skyzen ERM")
                    .orElse("Skyzen ERM");
        } catch (Exception e) {
            return "Skyzen ERM";
        }
    }

    private static String firstName(User u) {
        if (u == null) return "there";
        String full = u.getFullName();
        if (full == null || full.isBlank()) return "there";
        return full.trim().split("\\s+", 2)[0];
    }

    private static String categoryLabel(String category) {
        if (category == null) return "onboarding document";
        return switch (category) {
            case "W4" -> "W-4 tax form";
            case "I9" -> "I-9 Section 1";
            case "ACH" -> "ACH direct deposit form";
            case "EMERGENCY_CONTACT" -> "emergency contact form";
            case "HANDBOOK_ACK" -> "employee handbook acknowledgment";
            case "I983" -> "I-983 training plan";
            default -> category.replace('_', ' ').toLowerCase();
        };
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
