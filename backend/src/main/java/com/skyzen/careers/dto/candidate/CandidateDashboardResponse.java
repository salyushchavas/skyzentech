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
