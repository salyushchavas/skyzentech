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
