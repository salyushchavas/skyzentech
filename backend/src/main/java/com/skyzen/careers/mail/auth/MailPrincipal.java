package com.skyzen.careers.mail.auth;

import com.skyzen.careers.mail.entity.MailRole;

import java.util.UUID;

/**
 * Authenticated mail identity placed in the SecurityContext by
 * {@link MailJwtAuthenticationFilter} and injected into mail controllers via
 * {@code @AuthenticationPrincipal MailPrincipal}. Distinct from Skyzen's
 * {@code User} principal — Skyzen's globally-registered filters inspect the
 * principal with {@code instanceof User} and therefore ignore this type.
 */
public record MailPrincipal(
        UUID accountId,
        String email,
        String displayName,
        UUID domainId,
        MailRole role,
        boolean mustChangePassword
) {
}
