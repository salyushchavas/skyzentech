package com.skyzen.careers.mail;

import com.skyzen.careers.auth.JwtUtil;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.mail.auth.MailJwtUtil;
import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.entity.MailAccountStatus;
import com.skyzen.careers.mail.entity.MailDomain;
import com.skyzen.careers.mail.entity.MailRole;
import com.skyzen.careers.mail.exception.MailAuthException;
import com.skyzen.careers.mail.service.MailSessionTokenService;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure (no Spring / no DB) verification of the mail↔Skyzen token wall. This is
 * the crypto core of isolation tests (a) and (b): because the two JwtUtils are
 * built with DIFFERENT secrets, a token minted by one CANNOT be verified by the
 * other. Also asserts the refresh-token hash is deterministic + collision-safe.
 */
class MailAuthIsolationTest {

    // Two distinct >=32-byte secrets.
    private static final String SKYZEN_SECRET = "skyzen-test-secret-0123456789-abcdefghijklmnop";
    private static final String MAIL_SECRET = "mail-test-secret-ZYXWVUTSRQPONMLK-9876543210!!";

    private final JwtUtil skyzenJwt = new JwtUtil(SKYZEN_SECRET, 15, 0);
    private final MailJwtUtil mailJwt = new MailJwtUtil(MAIL_SECRET, 15);

    private User skyzenUser() {
        return User.builder()
                .id(UUID.randomUUID())
                .email("admin@skyzen.test")
                .fullName("Skyzen Admin")
                .roles(Set.of(UserRole.SUPER_ADMIN))
                .build();
    }

    private MailAccount mailAccount() {
        MailDomain domain = MailDomain.builder()
                .id(UUID.randomUUID())
                .name("skyzentech.com")
                .displayName("Skyzentech")
                .active(true)
                .build();
        return MailAccount.builder()
                .id(UUID.randomUUID())
                .domain(domain)
                .localPart("admin")
                .displayName("Mail Super Admin")
                .passwordHash("$2a$10$ignored")
                .role(MailRole.SUPER_ADMIN)
                .status(MailAccountStatus.ACTIVE)
                .mustChangePassword(false)
                .build();
    }

    @Test
    void mailTokenCannotBeValidatedBySkyzen() {
        String mailToken = mailJwt.generateAccessToken(mailAccount(), UUID.randomUUID());
        // Skyzen's JwtUtil must reject a mail-signed token (signature mismatch).
        assertThrows(Exception.class, () -> skyzenJwt.parseToken(mailToken));
    }

    @Test
    void skyzenTokenCannotBeValidatedByMail() {
        String skyzenToken = skyzenJwt.generateAccessToken(skyzenUser(), UUID.randomUUID());
        // Mail's MailJwtUtil must reject a Skyzen-signed token (signature mismatch).
        assertThrows(Exception.class, () -> mailJwt.parseToken(skyzenToken));
    }

    @Test
    void eachUtilValidatesItsOwnToken() {
        MailAccount acct = mailAccount();
        String mailToken = mailJwt.generateAccessToken(acct, UUID.randomUUID());
        Claims mailClaims = mailJwt.parseToken(mailToken);
        assertEquals(acct.getId(), mailJwt.extractAccountId(mailClaims));
        assertEquals("admin@skyzentech.com", mailClaims.get("email"));
        assertEquals("SUPER_ADMIN", mailClaims.get("role"));
        assertEquals(acct.getDomain().getId().toString(), mailClaims.get("did"));

        User u = skyzenUser();
        String skyzenToken = skyzenJwt.generateAccessToken(u, UUID.randomUUID());
        Claims skyzenClaims = skyzenJwt.parseToken(skyzenToken);
        assertEquals(u.getId(), skyzenJwt.extractUserId(skyzenClaims));
    }

    @Test
    void mustChangeMarkerIsCarriedInMailToken() {
        MailAccount acct = mailAccount();
        acct.setMustChangePassword(true);
        Claims claims = mailJwt.parseToken(mailJwt.generateAccessToken(acct, UUID.randomUUID()));
        assertEquals(Boolean.TRUE, claims.get("mcp"));
    }

    @Test
    void refreshHashIsDeterministicAndCollisionSafe() {
        String a = "raw-refresh-token-value-A";
        String b = "raw-refresh-token-value-B";
        assertEquals(MailSessionTokenService.hash(a), MailSessionTokenService.hash(a));
        assertNotEquals(MailSessionTokenService.hash(a), MailSessionTokenService.hash(b));
        // SHA-256 hex = 64 chars.
        assertTrue(MailSessionTokenService.hash(a).matches("[0-9a-f]{64}"));
    }

    @Test
    void unconfiguredSecret_bootsButFailsOnUse() {
        // A blank MAIL_JWT_SECRET (env unset) must NOT throw at construction —
        // the app boots; mail is simply disabled. Using it returns 503.
        MailJwtUtil unconfigured = new MailJwtUtil("", 15);
        assertFalse(unconfigured.isConfigured());
        MailAuthException ex = assertThrows(MailAuthException.class,
                () -> unconfigured.generateAccessToken(mailAccount(), UUID.randomUUID()));
        assertEquals("MAIL_NOT_CONFIGURED", ex.getCode());
    }
}
