package com.skyzen.careers.mail.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Login / refresh / change-password response. Mirrors Skyzen's AuthResponse
 * shape but mail-scoped. The raw {@code refreshToken} is returned only at issue
 * time (never persisted raw).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MailAuthResponse(
        String token,
        String refreshToken,
        Long accessTokenExpiresInSeconds,
        String accountId,
        String email,
        String displayName,
        String role,
        Boolean mustChangePassword
) {
}
