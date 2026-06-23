package com.skyzen.careers.mail.auth;

import com.skyzen.careers.mail.entity.MailAccount;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
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
 */
@Component
public class MailJwtUtil {

    private final SecretKey signingKey;
    private final long accessTtlSeconds;

    public MailJwtUtil(
            @Value("${app.webmail.jwt.secret}") String secret,
            @Value("${app.webmail.auth.access-token-ttl-minutes:15}") long accessTtlMinutes
    ) {
        byte[] keyBytes = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "MAIL_JWT_SECRET must be at least 32 bytes for HS256 (got " + keyBytes.length + ")");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.accessTtlSeconds = Duration.ofMinutes(accessTtlMinutes).toSeconds();
    }

    /** Access token bound to the refresh-token row that minted it. */
    public String generateAccessToken(MailAccount account, UUID refreshTokenId) {
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
                .signWith(signingKey)
                .compact();
    }

    public Claims parseToken(String token) {
        Jws<Claims> jws = Jwts.parser()
                .verifyWith(signingKey)
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
