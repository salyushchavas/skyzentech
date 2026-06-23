package com.skyzen.careers.mail.auth;

import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.exception.MailAuthException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Mirrors Skyzen's {@code JwtUtil} (HS256, jjwt 0.12.6) but with a SEPARATE
 * signing secret ({@code MAIL_JWT_SECRET}) so mail and Skyzen tokens are
 * mutually non-validatable. Subject = mail account UUID; claims carry the full
 * email, role, domain id ({@code did}) and a must-change marker ({@code mcp}).
 *
 * <p><b>Boot-safe by design.</b> The mail module is ADDITIVE and must never be
 * able to crash the core Skyzen app. So a missing/short {@code MAIL_JWT_SECRET}
 * does NOT throw at startup (mirroring Skyzen's Judge0/Zoom "boots clean when
 * unset" pattern): the bean constructs un-configured, the app boots normally,
 * and only the mail auth chain is affected — token operations then return
 * 503 {@code MAIL_NOT_CONFIGURED} until a valid secret is provided.</p>
 */
@Component
@Slf4j
public class MailJwtUtil {

    private static final int MIN_SECRET_BYTES = 32;

    private final SecretKey signingKey; // null when not configured
    private final boolean configured;
    private final long accessTtlSeconds;

    public MailJwtUtil(
            @Value("${app.webmail.jwt.secret:}") String secret,
            @Value("${app.webmail.auth.access-token-ttl-minutes:15}") long accessTtlMinutes
    ) {
        byte[] keyBytes = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length >= MIN_SECRET_BYTES) {
            this.signingKey = Keys.hmacShaKeyFor(keyBytes);
            this.configured = true;
        } else {
            this.signingKey = null;
            this.configured = false;
            log.warn("MAIL_JWT_SECRET is unset or shorter than {} bytes — the mail module is "
                    + "DISABLED (the rest of the app boots normally). /api/mail/** auth returns "
                    + "503 until a valid MAIL_JWT_SECRET is set.", MIN_SECRET_BYTES);
        }
        this.accessTtlSeconds = Duration.ofMinutes(accessTtlMinutes).toSeconds();
    }

    /** True when a valid signing secret is configured. */
    public boolean isConfigured() {
        return configured;
    }

    private SecretKey requireKey() {
        if (!configured) {
            throw new MailAuthException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Mail is not configured", "MAIL_NOT_CONFIGURED");
        }
        return signingKey;
    }

    /** Access token bound to the refresh-token row that minted it. */
    public String generateAccessToken(MailAccount account, UUID refreshTokenId) {
        SecretKey key = requireKey();
        Instant now = Instant.now();
        String email = account.getLocalPart() + "@" + account.getDomain().getName();
        return Jwts.builder()
                .subject(account.getId().toString())
                .claim("email", email)
                .claim("role", account.getRole().name())
                .claim("did", account.getDomain().getId().toString())
                .claim("mcp", Boolean.TRUE.equals(account.getMustChangePassword()))
                .claim("rtid", refreshTokenId != null ? refreshTokenId.toString() : null)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(accessTtlSeconds)))
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        Jws<Claims> jws = Jwts.parser()
                .verifyWith(requireKey())
                .build()
                .parseSignedClaims(token);
        return jws.getPayload();
    }

    public UUID extractAccountId(Claims claims) {
        return UUID.fromString(claims.getSubject());
    }

    public long accessTtlSeconds() {
        return accessTtlSeconds;
    }
}
