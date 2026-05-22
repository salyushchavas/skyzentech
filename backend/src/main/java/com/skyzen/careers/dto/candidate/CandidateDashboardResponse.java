package com.skyzen.careers.dto.candidate;

import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Aggregate payload powering the redesigned candidate dashboard. All fields
 * are present on every response shape — empty lists / null nextStep / 0% are
 * the empty-state. The frontend never has to special-case "missing key".
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateDashboardResponse {

    private String candidateName;

    /** % of name + phone + dateOfBirth + hasResume that are filled (0–100). */
    private int profileComplete;

    /** Most urgent next action, or null when nothing actionable is queued. */
    private NextStep nextStep;

    private List<ApplicationSummary> applications;

    private List<UpcomingItem> upcoming;

    private List<ActivityItem> recentActivity;

    /**
     * Phase 3 step 10 follow-up — the candidate's active engagement summary,
     * used by the per-application stepper to override the final-stage label
     * ("Onboarding" / "Active" / "Completed" / "Blocked") so it agrees with
     * the dashboard banner. Null when the candidate has no post-offer
     * engagement (pre-offer state, or accepted-but-no-engagement legacy).
     */
    private EngagementSummary engagement;

    /**
     * Post-offer compliance status panel — surfaces "HR has completed your I-9
     * verification" / "Awaiting HR" + E-Verify + I-983 (STEM_OPT only) to the
     * candidate so they know who owes what next. Null/empty pre-offer.
     */
    private List<ComplianceItem> compliance;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NextStep {
        /** OFFER | INTERVIEW | ONBOARDING | WORK | SHORTLISTED | APPLIED | PROFILE | BROWSE */
        private String type;
        private String title;
        private String subtitle;
        private String ctaLabel;
        private String ctaHref;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ApplicationSummary {
        private UUID id;
        private String position;
        private String entityName;
        /** Real ApplicationStatus enum name. */
        private String status;
        /** 0..4 stage index in the candidate funnel; -1 for exited statuses. */
        private int stageIndex;
        private boolean isExited;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpcomingItem {
        /** INTERVIEW | OFFER_EXPIRY | ONBOARDING_DUE | EVALUATION */
        private String type;
        private String title;
        private String subtitle;
        private Instant at;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ActivityItem {
        private String text;
        private Instant at;
    }

    /**
     * Engagement-derived overrides for the per-application stepper's final
     * (post-offer) stage. The frontend matches by {@code applicationId} and,
     * for the matched row, replaces the hardcoded "Hired" label and styling
     * with these values so the stepper reads coherently with the banner.
     */
    /**
     * Per-compliance-item state row. {@code kind} is the stable key the
     * frontend keys icons + deep-links off ("I9_SECTION_1", "I9_SECTION_2",
     * "EVERIFY", "I983"). {@code state} is the visible label state —
     * "NOT_STARTED" / "IN_PROGRESS" / "AWAITING_HR" / "COMPLETED" / "BLOCKED".
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ComplianceItem {
        private String kind;
        private String label;
        private String state;
        /** Human subtitle — e.g. "Verified by Casey Lee on May 22, 2026". */
        private String subtitle;
        /** Optional deep link to where the candidate can act or view detail. */
        private String href;
        private Instant completedAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EngagementSummary {
        /** Application id that owns this engagement (joins the per-app stepper). */
        private UUID applicationId;
        /** EngagementStatus enum name verbatim. */
        private String status;
        /** Label to render at stage 4 — "Onboarding" / "Active" / "Completed" / "Blocked". */
        private String finalStageLabel;
        /** Visual state — "current" / "completed" / "blocked". */
        private String finalStageState;
        private long onboardingTotal;
        private long onboardingCompleted;
    }
}
