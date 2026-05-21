package com.skyzen.careers.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Login + registration response. Adds verification + applicant-ID fields
 * (phase 1.2) so the frontend can route an unverified candidate straight to
 * the verify-email page without an extra round-trip.
 *
 * {@code devVerificationCode} is non-null ONLY when the registration just
 * issued a fresh code AND {@code app.notification.surface-stub=true} (default
 * for dev/staging). Production must set the flag to false so codes never
 * leak in API responses.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(
        String token,
        String userId,
        String email,
        String fullName,
        List<String> roles,
        Boolean emailVerified,
        String applicantId,
        String devVerificationCode
) {}
