package com.skyzen.careers.enums;

public enum ApplicationStatus {
    APPLIED,
    // Phase 2.1: optional lightweight web screening between Apply and Shortlist.
    // Both states sit in the "Shortlisted" band of the 5-stage stepper.
    SCREENING_SENT,
    SCREENING_COMPLETED,
    SHORTLISTED,
    INTERVIEW_SCHEDULED,
    INTERVIEWED,
    // Phase 2.3 — conditional selection. Staff confirm "you're selected,
    // pending the formal offer + compliance" off the 2.2 scorecard; the offer
    // follows. Sits in the Offer band of the 5-stage stepper.
    SELECTED_CONDITIONAL,
    OFFERED,
    ACCEPTED,
    ONBOARDING,
    ACTIVE,
    HIRED,
    COMPLETED,
    REJECTED,
    WITHDRAWN,
    LAPSED,
    NO_SHOW
}
