package com.skyzen.careers.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Login + registration response. Includes the access + refresh token pair
 * issued for a freshly-created session.
 *
 * <p>Security note: the verification code itself is NEVER returned by any
 * endpoint. It is delivered only via email (real SMTP in prod; the backend
 * log when {@code app.notification.surface-stub=true} in dev for the
 * developer's eyes only — never round-tripped to the client).</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(
        String token,
        String refreshToken,
        Long accessTokenExpiresInSeconds,
        String userId,
        String email,
        String fullName,
        List<String> roles,
        Boolean emailVerified,
        String applicantId
) {}
