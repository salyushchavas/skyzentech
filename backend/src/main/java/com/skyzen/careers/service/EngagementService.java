package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.application.EngagementLifecycle;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.EngagementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
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
    private final ObjectMapper objectMapper;

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
        return saved;
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
