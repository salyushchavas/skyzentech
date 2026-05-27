package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.application.EngagementLifecycle;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.WorkAuthTrack;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.notification.NotificationService;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.I9FormRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Phase 3 step 2 — gated mutation surface for {@link Engagement}. Mirrors the
 * Phase 1.1b {@code ApplicationService.transitionTo} pattern exactly:
 *
 *   - {@link #transitionTo} enforces {@link EngagementLifecycle#LEGAL_TRANSITIONS}.
 *     Illegal moves throw {@link BadRequestException} → 400 via
 *     {@code GlobalExceptionHandler}; same-state is a legal no-op (no save,
 *     no audit row).
 *   - {@link #transitionToSystem} bypasses the legality check for SYSTEM /
 *     boot-time backfill use ONLY, but still writes the audit row so the
 *     override is visible.
 *
 * No callers yet. Step 3 wires creation at OFFER_ACCEPTED; later steps drive
 * compliance-gate-driven transitions (PENDING_COMPLIANCE → READY_TO_START).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementService {

    private final EngagementRepository engagementRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final I9FormRepository i9FormRepository;

    /**
     * Phase 3 step 3 — spin up an Engagement at OFFER_ACCEPTED. Snapshots the
     * candidate's {@code expectedTrack} onto the engagement (so later
     * Candidate.expectedTrack edits don't drift the compliance routing) and
     * stamps the planned dates from the offer.
     *
     * Idempotent: if an Engagement already exists for this offer, we return it
     * untouched (no duplicate audit, no duplicate row). The DB also enforces
     * uniqueness on offer_id and application_id as a safety net.
     *
     * Runs in {@code REQUIRES_NEW} so a creation failure rolls back ONLY this
     * inner transaction — the surrounding {@code OfferService.acceptInternal}
     * keeps its ACCEPTED transitions intact even if engagement-create blips.
     * The step-11 backfill is the safety net for any miss here.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Engagement createForAcceptedOffer(Offer offer, User actor) {
        if (offer == null || offer.getId() == null) {
            throw new IllegalArgumentException("offer must be non-null with an id");
        }

        // Idempotency check before insert — return the existing row gracefully
        // instead of letting the unique constraint surface a 409.
        Optional<Engagement> existing = engagementRepository.findByOfferId(offer.getId());
        if (existing.isPresent()) {
            return existing.get();
        }

        // Resolve associations. The caller (acceptInternal) loaded the offer
        // via findByIdWithGraph which fetch-joins application → candidate →
        // jobPosting → entity, so these reads are already populated even
        // though we're now in a fresh persistence context.
        Application application = offer.getApplication();
        Candidate candidate = application != null ? application.getCandidate() : null;
        JobPosting posting = application != null ? application.getJobPosting() : null;
        StaffingEntity entity = posting != null ? posting.getEntity() : null;
        if (application == null || candidate == null || entity == null) {
            log.warn("Cannot create engagement for offer {} — missing application/candidate/entity",
                    offer.getId());
            return null;
        }

        WorkAuthTrack trackSnapshot = candidate.getExpectedTrack(); // may be null
        UUID actorId = actor != null ? actor.getId() : null;

        Engagement engagement = Engagement.builder()
                .application(application)
                .candidate(candidate)
                .offer(offer)
                .entity(entity)
                .track(trackSnapshot)
                .status(EngagementStatus.PENDING_COMPLIANCE)
                .plannedStartDate(offer.getStartDate())
                .plannedEndDate(offer.getExpectedEndDate())
                .createdBy(actorId)
                .build();

        engagement = engagementRepository.save(engagement);
        writeCreateAudit(engagement, actorId);
        log.info("Engagement {} created for accepted offer {} (track={}, start={})",
                engagement.getId(), offer.getId(), trackSnapshot, offer.getStartDate());
        return engagement;
    }

    private void writeCreateAudit(Engagement engagement, UUID actorId) {
        Map<String, Object> afterJson = new LinkedHashMap<>();
        afterJson.put("status", engagement.getStatus());
        afterJson.put("track", engagement.getTrack());
        afterJson.put("plannedStartDate", engagement.getPlannedStartDate());
        afterJson.put("plannedEndDate", engagement.getPlannedEndDate());
        afterJson.put("applicationId", engagement.getApplication() != null
                ? engagement.getApplication().getId() : null);
        afterJson.put("offerId", engagement.getOffer() != null
                ? engagement.getOffer().getId() : null);
        AuditLog entry = AuditLog.builder()
                .entityType("Engagement")
                .entityId(engagement.getId())
                .action("CREATE")
                .userId(actorId)
                .afterJson(serializeJson(afterJson))
                .build();
        auditLogRepository.save(entry);
    }

    /**
     * Phase 3 step 9 — HR-driven "mark ready" action. Consults the compliance
     * router for per-track requirements; on success, gates through
     * {@link #transitionTo} from PENDING_COMPLIANCE to READY_TO_START. On
     * failure, throws {@link BadRequestException} with a comma-joined list of
     * the missing items so the UI can render a clear blocker message.
     *
     * Callers MUST pre-load the engagement via the repo before calling.
     * Same-state (already READY_TO_START) is a legal no-op via transitionTo.
     */
    @Transactional
    public Engagement markReady(Engagement engagement,
                                com.skyzen.careers.service.ComplianceRoutingService router,
                                User actor) {
        if (engagement == null) {
            throw new com.skyzen.careers.exception.BadRequestException(
                    "Engagement not found");
        }
        java.util.List<String> missing = router.missingRequirements(engagement);
        if (!missing.isEmpty()) {
            throw new com.skyzen.careers.exception.BadRequestException(
                    "Not ready: " + String.join(", ", missing));
        }
        return transitionTo(engagement, EngagementStatus.READY_TO_START,
                "MARK_READY", actor);
    }

    /**
     * Phase 3 step 9 — HR-driven "start" action. Pure manual: HR confirms the
     * intern is actually starting today. The {@link #transitionTo} path
     * stamps {@code actualStartDate = today} when moving to ACTIVE, so this
     * is one call.
     */
    @Transactional
    public Engagement startEngagement(Engagement engagement, User actor) {
        if (engagement == null) {
            throw new com.skyzen.careers.exception.BadRequestException(
                    "Engagement not found");
        }
        return transitionTo(engagement, EngagementStatus.ACTIVE, "START", actor);
    }

    /**
     * Phase 3 step 8 — "the active engagement" lookup used by onboarding +
     * Group C creation paths to attach an {@code engagement_id} to new rows.
     * Picks the candidate's most-recent in-funnel engagement (excludes
     * BLOCKED_NO_AUTHORIZATION + TERMINATED, which shouldn't accrue new work).
     * Returns {@code Optional.empty()} for legacy candidates with no
     * engagement; callers must tolerate null and fall back to candidate-keyed
     * behaviour (back-compat is mandatory through step 11's backfill).
     */
    @Transactional(readOnly = true)
    public java.util.Optional<Engagement> resolveActiveForCandidate(UUID candidateId) {
        if (candidateId == null) return java.util.Optional.empty();
        return engagementRepository.findByCandidateId(candidateId).stream()
                .filter(e -> e.getStatus() != EngagementStatus.BLOCKED_NO_AUTHORIZATION
                        && e.getStatus() != EngagementStatus.TERMINATED)
                .max(java.util.Comparator.comparing(
                        Engagement::getCreatedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())));
    }

    /**
     * Gated status transition — the single entry point every Engagement
     * write-site must go through (once consumers exist). Same-state target is
     * a no-op; illegal target throws {@link BadRequestException}. On a real
     * transition: sets the status, stamps {@code actualStartDate} when moving
     * to ACTIVE, stamps {@code actualEndDate} when moving to COMPLETED or
     * TERMINATED, persists, and writes exactly ONE audit row.
     */
    @Transactional
    public Engagement transitionTo(Engagement engagement,
                                   EngagementStatus target,
                                   String auditAction,
                                   User actor) {
        EngagementStatus from = engagement.getStatus();
        if (from == target) return engagement; // legal no-op
        Set<EngagementStatus> allowed =
                EngagementLifecycle.LEGAL_TRANSITIONS.getOrDefault(from, Collections.emptySet());
        if (!allowed.contains(target)) {
            throw new BadRequestException(
                    "Cannot move engagement from " + from + " to " + target);
        }
        return applyTransition(engagement, from, target, auditAction,
                actor != null ? actor.getId() : null);
    }

    /**
     * Override path — bypasses {@link EngagementLifecycle#LEGAL_TRANSITIONS}
     * but STILL audits. Reserved for SYSTEM (boot-time backfill) and ADMIN
     * corrections that need to break the normal lifecycle. Same-state remains
     * a no-op. Callers must justify why the gated path is wrong for them.
     */
    @Transactional
    public Engagement transitionToSystem(Engagement engagement,
                                         EngagementStatus target,
                                         String auditAction,
                                         UUID actorId) {
        EngagementStatus from = engagement.getStatus();
        if (from == target) return engagement;
        return applyTransition(engagement, from, target, auditAction, actorId);
    }

    private Engagement applyTransition(Engagement engagement,
                                       EngagementStatus from,
                                       EngagementStatus target,
                                       String auditAction,
                                       UUID actorId) {
        engagement.setStatus(target);
        // Phase-derived dates. Hibernate's @UpdateTimestamp handles updatedAt;
        // actualStartDate/actualEndDate are domain-driven, not timestamps.
        LocalDate today = LocalDate.now();
        if (target == EngagementStatus.ACTIVE && engagement.getActualStartDate() == null) {
            engagement.setActualStartDate(today);
        }
        if ((target == EngagementStatus.COMPLETED || target == EngagementStatus.TERMINATED)
                && engagement.getActualEndDate() == null) {
            engagement.setActualEndDate(today);
        }
        Engagement saved = engagementRepository.save(engagement);
        writeStatusAudit(saved.getId(), auditAction, actorId, from, target);

        // Role flip on hire — the canonical "engagement goes ACTIVE" moment.
        // APPLICANT becomes INTERN. We don't unwind on COMPLETED/TERMINATED:
        // once someone has been an intern, they keep INTERN until an admin
        // explicitly changes the role (audit / forensic posture).
        if (target == EngagementStatus.ACTIVE) {
            promoteApplicantToIntern(saved, actorId);
            // Batch-1 — onboarding welcome to the new intern. Idempotent per
            // engagement; best-effort: a send failure must NOT block activation.
            try {
                notificationService.sendOnboardingWelcome(saved);
            } catch (Exception e) {
                log.warn("ONBOARDING_WELCOME notify failed (non-fatal) for engagement {}: {}",
                        saved.getId(), e.getMessage());
            }
            // Batch-2 — I-9 §1 reminder. Only fires if there's an I-9 row and
            // it's not already past §1 (i.e. still NOT_STARTED). Idempotent
            // per (event, form_id).
            try {
                fireI9Section1ReminderIfPending(saved);
            } catch (Exception e) {
                log.warn("I9_SECTION1_REMINDER fire failed (non-fatal) for engagement {}: {}",
                        saved.getId(), e.getMessage());
            }
            // Batch-2 — I-983 plan needed (STEM OPT only).
            if (saved.getTrack() == WorkAuthTrack.STEM_OPT) {
                try {
                    notificationService.sendI983PlanNeeded(saved);
                } catch (Exception e) {
                    log.warn("I983_PLAN_NEEDED notify failed (non-fatal) for engagement {}: {}",
                            saved.getId(), e.getMessage());
                }
            }
        }
        return saved;
    }

    /**
     * I-9 §1 reminder dispatch on engagement activation. We fire only when an
     * I-9 row exists AND it's still pre-§1 (NOT_STARTED) — past that, the
     * intern has already done their part. The scheduler (batch-2, daily)
     * fires recurring reminders for stale §1 in a separate path; this is the
     * one-shot at activation.
     */
    private void fireI9Section1ReminderIfPending(Engagement engagement) {
        if (engagement == null || engagement.getCandidate() == null) return;
        UUID candidateId = engagement.getCandidate().getId();
        i9FormRepository.findByCandidateId(candidateId).ifPresent(form -> {
            if (form.getStatus() == com.skyzen.careers.enums.I9Status.NOT_STARTED) {
                notificationService.sendI9Section1Reminder(form);
            }
        });
    }

    /**
     * Promote the engaged candidate's user from APPLICANT → INTERN. Idempotent:
     * if the user is already INTERN, no-op. Wrapped in a defensive try so a
     * stray missing user / null candidate cannot derail the ACTIVE transition.
     * Writes a USER_ROLE_FLIP audit row so the change is forensically visible.
     */
    private void promoteApplicantToIntern(Engagement engagement, UUID actorId) {
        try {
            if (engagement.getCandidate() == null
                    || engagement.getCandidate().getUser() == null) {
                return;
            }
            UUID userId = engagement.getCandidate().getUser().getId();
            User user = userRepository.findById(userId).orElse(null);
            if (user == null || user.getRoles() == null) return;
            Set<UserRole> roles = user.getRoles();
            boolean wasApplicant = roles.remove(UserRole.APPLICANT);
            boolean alreadyIntern = roles.contains(UserRole.INTERN);
            if (alreadyIntern && !wasApplicant) {
                return; // already promoted on a previous boot / activation
            }
            roles.add(UserRole.INTERN);
            user.setRoles(roles);
            userRepository.save(user);
            AuditLog entry = AuditLog.builder()
                    .entityType("User")
                    .entityId(user.getId())
                    .action("USER_ROLE_FLIP")
                    .userId(actorId)
                    .afterJson("{\"from\":\"APPLICANT\",\"to\":\"INTERN\","
                            + "\"engagementId\":\"" + engagement.getId() + "\"}")
                    .build();
            auditLogRepository.save(entry);
            log.info("Role flip APPLICANT→INTERN on engagement ACTIVE: user {}",
                    user.getEmail());
        } catch (Exception e) {
            // Non-fatal — the engagement transition still committed. Log + move on.
            log.warn("Role flip APPLICANT→INTERN failed for engagement {}: {}",
                    engagement.getId(), e.getMessage(), e);
        }
    }

    private void writeStatusAudit(UUID engagementId,
                                  String action,
                                  UUID userId,
                                  EngagementStatus before,
                                  EngagementStatus after) {
        Map<String, Object> beforeJson = new LinkedHashMap<>();
        beforeJson.put("status", before);
        Map<String, Object> afterJson = new LinkedHashMap<>();
        afterJson.put("status", after);
        AuditLog entry = AuditLog.builder()
                .entityType("Engagement")
                .entityId(engagementId)
                .action(action)
                .userId(userId)
                .beforeJson(serializeJson(beforeJson))
                .afterJson(serializeJson(afterJson))
                .build();
        auditLogRepository.save(entry);
    }

    private String serializeJson(Map<String, Object> snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize engagement audit snapshot: {}", e.getMessage());
            return new HashMap<>(snapshot).toString();
        }
    }
}
