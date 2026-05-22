package com.skyzen.careers.service;

import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.WorkAuthTrack;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Phase 3 step 4 — the track router. Runs once at engagement creation, reads
 * the snapshot {@code track} + {@code authorizedToWork}, and:
 *
 *   - sets the engagement status (PENDING_COMPLIANCE or BLOCKED_NO_AUTHORIZATION),
 *   - augments the onboarding checklist with the per-track required tasks.
 *
 * This step does NOT touch I-9 / I-983 / E-Verify entities — those rows are
 * created by their existing services downstream (steps 5-7). The router only
 * sets up the checklist and the engagement phase.
 *
 * <b>Safe defaults (PRODUCT.md §8):</b> E-Verify is required by default ONLY
 * for STEM_OPT. Other tracks get E-Verify only if the operator opts in via
 * {@code app.compliance.everify-non-stem=true}. "No authorization" is a
 * process route to HR/legal — NOT a hire decision.
 */
@Service
@Slf4j
public class ComplianceRoutingService {

    // ── Task-key constants — keep grep-able and align with TRACK_TEMPLATES. ──

    private static final String TASK_HR_AUTHORIZATION_REVIEW = "HR_AUTHORIZATION_REVIEW";
    private static final String TASK_I983_DRAFT = "I983_DRAFT";
    private static final String TASK_I983_DSO_APPROVAL = "I983_DSO_APPROVAL";
    private static final String TASK_EVERIFY_BY_DAY_3 = "EVERIFY_BY_DAY_3";
    private static final String TASK_CPT_I20_VERIFY = "CPT_I20_VERIFY";

    private final EngagementService engagementService;
    private final OnboardingService onboardingService;

    /**
     * Whether to require E-Verify for non-STEM_OPT tracks. Default FALSE.
     * Driven by employer enrollment + state mandates — operations sets this
     * via {@code app.compliance.everify-non-stem} in application.properties.
     */
    private final boolean everifyEnabledForNonStem;

    public ComplianceRoutingService(
            EngagementService engagementService,
            OnboardingService onboardingService,
            @Value("${app.compliance.everify-non-stem:false}") boolean everifyEnabledForNonStem) {
        this.engagementService = engagementService;
        this.onboardingService = onboardingService;
        this.everifyEnabledForNonStem = everifyEnabledForNonStem;
    }

    /**
     * Route a freshly-created engagement. Idempotent through downstream
     * services — the underlying task add is keyed on
     * {@code (candidate, taskKey, offer)} and a re-route adds nothing new.
     * Catches all internal exceptions so a routing bug never tears down the
     * outer accept/engagement flow.
     */
    @Transactional
    public void routeNewEngagement(Engagement engagement, User actor) {
        if (engagement == null || engagement.getCandidate() == null) {
            log.warn("Cannot route — engagement or candidate is null");
            return;
        }
        try {
            Candidate candidate = engagement.getCandidate();
            WorkAuthTrack track = engagement.getTrack(); // snapshot, may be null
            Boolean authorized = candidate.getAuthorizedToWork();

            if (isBlocked(authorized, track)) {
                onboardingService.augmentTasksForTrack(
                        engagement, List.of(TASK_HR_AUTHORIZATION_REVIEW));
                UUID actorId = actor != null ? actor.getId() : null;
                engagementService.transitionToSystem(engagement,
                        EngagementStatus.BLOCKED_NO_AUTHORIZATION,
                        "ROUTE_NO_AUTH",
                        actorId);
                log.info("Engagement {} routed to BLOCKED_NO_AUTHORIZATION (authorized={}, track={})",
                        engagement.getId(), authorized, track);
                return;
            }

            List<String> extras = trackSpecificTaskKeys(track);
            if (!extras.isEmpty()) {
                onboardingService.augmentTasksForTrack(engagement, extras);
            }
            log.info("Engagement {} routed (track={}, extras={})",
                    engagement.getId(), track, extras);
            // Status stays PENDING_COMPLIANCE — set by EngagementService.createForAcceptedOffer.
        } catch (Exception e) {
            log.warn("Routing failed for engagement {}: {}",
                    engagement.getId(), e.getMessage(), e);
        }
    }

    /**
     * Block when the candidate explicitly answered "no" to authorisation, OR
     * when they haven't answered AND haven't picked any expected track.
     * Track is set but authorisation null → not blocked (e.g. a candidate
     * volunteers STEM_OPT but skipped the yes/no — better to route them so
     * the I-983/E-Verify pieces appear; HR will surface the missing answer).
     */
    private boolean isBlocked(Boolean authorized, WorkAuthTrack track) {
        if (Boolean.FALSE.equals(authorized)) return true;
        return authorized == null && track == null;
    }

    private List<String> trackSpecificTaskKeys(WorkAuthTrack track) {
        List<String> keys = new ArrayList<>();
        if (track == WorkAuthTrack.STEM_OPT) {
            keys.add(TASK_I983_DRAFT);
            keys.add(TASK_I983_DSO_APPROVAL);
            keys.add(TASK_EVERIFY_BY_DAY_3);
        } else if (track == WorkAuthTrack.CPT) {
            keys.add(TASK_CPT_I20_VERIFY);
            // No I-983, no E-Verify by default for CPT.
        }
        // OPT, OTHER, and null-track + authorized true: I-9 only (already in
        // the standard onboarding seed — no extras here).

        // E-Verify for non-STEM only when the operator opts in.
        if (everifyEnabledForNonStem
                && track != WorkAuthTrack.STEM_OPT
                && !keys.contains(TASK_EVERIFY_BY_DAY_3)) {
            keys.add(TASK_EVERIFY_BY_DAY_3);
        }
        return keys;
    }
}
