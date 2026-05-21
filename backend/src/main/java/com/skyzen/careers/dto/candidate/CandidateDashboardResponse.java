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
}
