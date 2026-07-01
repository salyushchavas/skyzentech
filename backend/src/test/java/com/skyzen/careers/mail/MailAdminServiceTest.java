package com.skyzen.careers.mail;

import com.skyzen.careers.mail.auth.MailPrincipal;
import com.skyzen.careers.mail.dto.CreateDomainRequest;
import com.skyzen.careers.mail.dto.CreateMailboxRequest;
import com.skyzen.careers.mail.dto.MailCredentialResponse;
import com.skyzen.careers.mail.dto.MailMailboxResponse;
import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.entity.MailAccountStatus;
import com.skyzen.careers.mail.entity.MailDomain;
import com.skyzen.careers.mail.entity.MailRole;
import com.skyzen.careers.mail.exception.MailApiException;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import com.skyzen.careers.mail.repository.MailAuditLogRepository;
import com.skyzen.careers.mail.repository.MailDomainRepository;
import com.skyzen.careers.mail.service.MailAdminService;
import com.skyzen.careers.mail.service.MailSessionTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * DB-free unit tests for the S3 admin security invariants: hash-only storage,
 * per-domain walling (404), the last-active-super-admin guard, ADMIN cannot
 * grant SUPER_ADMIN, and suspend revokes refresh tokens. Uses Mockito repos +
 * a REAL BCryptPasswordEncoder so the hash assertions are meaningful.
 */
class MailAdminServiceTest {

    private MailAccountRepository accountRepository;
    private MailDomainRepository domainRepository;
    private MailAuditLogRepository auditRepository;
    private MailSessionTokenService sessionTokenService;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private MailAdminService service;

    private MailDomain domainA;
    private MailDomain domainB;

    @BeforeEach
    void setUp() {
        accountRepository = mock(MailAccountRepository.class);
        domainRepository = mock(MailDomainRepository.class);
        auditRepository = mock(MailAuditLogRepository.class);
        sessionTokenService = mock(MailSessionTokenService.class);
        service = new MailAdminService(accountRepository, domainRepository, auditRepository,
                sessionTokenService, encoder);
        ReflectionTestUtils.setField(service, "generatedPasswordLength", 16);

        domainA = MailDomain.builder().id(UUID.randomUUID()).name("a.com").active(true).build();
        domainB = MailDomain.builder().id(UUID.randomUUID()).name("b.com").active(true).build();

        when(accountRepository.save(any(MailAccount.class))).thenAnswer(inv -> {
            MailAccount a = inv.getArgument(0);
            if (a.getId() == null) a.setId(UUID.randomUUID());
            return a;
        });
    }

    private MailAccount account(MailDomain domain, String localPart, MailRole role, MailAccountStatus status) {
        return MailAccount.builder()
                .id(UUID.randomUUID())
                .domain(domain)
                .localPart(localPart)
                .passwordHash("$2a$10$placeholderplaceholderplaceholderplaceholderpla")
                .role(role)
                .status(status)
                .mustChangePassword(false)
                .requireChangeOnFirstLogin(false)
                .quotaBytes(1L)
                .build();
    }

    private MailPrincipal principalFor(MailAccount a) {
        return new MailPrincipal(a.getId(), a.getLocalPart() + "@" + a.getDomain().getName(),
                a.getLocalPart(), a.getDomain().getId(), a.getRole(), false);
    }

    private void stubActor(MailAccount actor) {
        when(accountRepository.findById(actor.getId())).thenReturn(Optional.of(actor));
    }

    @Test
    void createMailbox_generatesPassword_storesHashNotPlaintext() {
        MailAccount actor = account(domainA, "admin", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        stubActor(actor);
        when(domainRepository.findById(domainA.getId())).thenReturn(Optional.of(domainA));
        when(accountRepository.existsByLocalPartAndDomain_Id("newuser", domainA.getId())).thenReturn(false);

        MailCredentialResponse res = service.createMailbox(principalFor(actor),
                new CreateMailboxRequest(domainA.getId(), "NewUser", "New User", null, null));

        assertEquals("newuser@a.com", res.email());
        assertTrue(res.oneTimePassword().length() >= 12, "generated password should be strong");
        assertTrue(res.mustChangePassword(), "requireChange defaults to true");
        // The DB must store a BCrypt hash, never the plaintext.
        org.mockito.ArgumentCaptor<MailAccount> cap = org.mockito.ArgumentCaptor.forClass(MailAccount.class);
        verify(accountRepository).save(cap.capture());
        String storedHash = cap.getValue().getPasswordHash();
        assertNotEquals(res.oneTimePassword(), storedHash);
        assertTrue(encoder.matches(res.oneTimePassword(), storedHash), "hash must verify the shown password");
    }

    @Test
    void createMailbox_adminCrossDomain_is404() {
        MailAccount actor = account(domainA, "admin", MailRole.ADMIN, MailAccountStatus.ACTIVE);
        stubActor(actor);
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.createMailbox(principalFor(actor),
                        new CreateMailboxRequest(domainB.getId(), "x", null, null, null)));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        verify(accountRepository, never()).save(any());
    }

    @Test
    void resetPassword_adminOnNonUser_is403() {
        MailAccount actor = account(domainA, "admin", MailRole.ADMIN, MailAccountStatus.ACTIVE);
        MailAccount target = account(domainA, "peer", MailRole.ADMIN, MailAccountStatus.ACTIVE);
        stubActor(actor);
        when(accountRepository.findById(target.getId())).thenReturn(Optional.of(target));
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.resetPassword(principalFor(actor), target.getId(), null));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    void resetPassword_revokesTokens_andSetsMustChange() {
        MailAccount actor = account(domainA, "admin", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        MailAccount target = account(domainA, "user", MailRole.USER, MailAccountStatus.ACTIVE);
        stubActor(actor);
        when(accountRepository.findById(target.getId())).thenReturn(Optional.of(target));

        MailCredentialResponse res = service.resetPassword(principalFor(actor), target.getId(), "typed-password-123");

        assertEquals("typed-password-123", res.oneTimePassword());
        assertTrue(target.getMustChangePassword());
        assertTrue(encoder.matches("typed-password-123", target.getPasswordHash()));
        verify(sessionTokenService).revokeAllForAccount(eq(target.getId()), any());
    }

    @Test
    void setRole_adminCannotGrantSuperAdmin_is403() {
        MailAccount actor = account(domainA, "admin", MailRole.ADMIN, MailAccountStatus.ACTIVE);
        MailAccount target = account(domainA, "user", MailRole.USER, MailAccountStatus.ACTIVE);
        stubActor(actor);
        when(accountRepository.findById(target.getId())).thenReturn(Optional.of(target));
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.setRole(principalFor(actor), target.getId(), MailRole.SUPER_ADMIN));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    void setRole_demotingLastSuperAdmin_is409() {
        MailAccount actor = account(domainA, "root", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        stubActor(actor);
        when(accountRepository.findById(actor.getId())).thenReturn(Optional.of(actor));
        when(accountRepository.lockByRoleAndStatus(MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE))
                .thenReturn(List.of(actor)); // only one active super-admin

        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.setRole(principalFor(actor), actor.getId(), MailRole.USER));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("MAIL_LAST_SUPER_ADMIN", ex.getCode());
    }

    @Test
    void suspend_lastSuperAdmin_is409() {
        MailAccount actor = account(domainA, "root", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        stubActor(actor);
        when(accountRepository.lockByRoleAndStatus(MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE))
                .thenReturn(List.of(actor));
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.suspend(principalFor(actor), actor.getId()));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
    }

    @Test
    void setRole_strandedSuperOnDeactivatedDomain_notCountedAsFallback_is409() {
        // Regression (last-super-admin lockout): the only OTHER super-admin lives on
        // a DEACTIVATED domain, so it cannot log in and is not a valid fallback.
        // Demoting the last REACHABLE super must be blocked (409) — the guard must
        // NOT count the stranded super.
        MailDomain deadDomain = MailDomain.builder()
                .id(UUID.randomUUID()).name("dead.com").active(false).build();
        MailAccount reachable = account(domainA, "root", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        MailAccount stranded = account(deadDomain, "ghost", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        stubActor(reachable);
        // Both rows are ACTIVE status (so the lock query returns them); the stranded
        // one is unreachable only because its DOMAIN is deactivated.
        when(accountRepository.lockByRoleAndStatus(MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE))
                .thenReturn(List.of(reachable, stranded));

        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.setRole(principalFor(reachable), reachable.getId(), MailRole.USER));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("MAIL_LAST_SUPER_ADMIN", ex.getCode());
        assertEquals(MailRole.SUPER_ADMIN, reachable.getRole(), "role must be unchanged when blocked");
        verify(accountRepository, never()).save(any());
    }

    @Test
    void setRole_secondSuperOnActiveDomain_isValidFallback_allowsDemotion() {
        // No false-positive: a genuine second super-admin on an ACTIVE domain IS a
        // valid fallback, so demoting one super still succeeds (the stricter guard
        // changes nothing for currently-valid operations).
        MailAccount superA = account(domainA, "root", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        MailAccount superB = account(domainB, "root2", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        stubActor(superA);
        when(accountRepository.lockByRoleAndStatus(MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE))
                .thenReturn(List.of(superA, superB)); // both on ACTIVE domains

        service.setRole(principalFor(superA), superA.getId(), MailRole.USER);

        assertEquals(MailRole.USER, superA.getRole(), "demotion allowed when an active-domain fallback exists");
        verify(accountRepository).save(superA);
    }

    @Test
    void suspend_user_revokesTokens_andSetsSuspended() {
        MailAccount actor = account(domainA, "admin", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        MailAccount target = account(domainA, "user", MailRole.USER, MailAccountStatus.ACTIVE);
        stubActor(actor);
        when(accountRepository.findById(target.getId())).thenReturn(Optional.of(target));

        MailMailboxResponse res = service.suspend(principalFor(actor), target.getId());
        assertEquals("SUSPENDED", res.status());
        assertEquals(MailAccountStatus.SUSPENDED, target.getStatus());
        verify(sessionTokenService).revokeAllForAccount(eq(target.getId()), any());
    }

    @Test
    void createDomain_adminForbidden_superAdminAllowed() {
        MailAccount admin = account(domainA, "admin", MailRole.ADMIN, MailAccountStatus.ACTIVE);
        stubActor(admin);
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(MailApiException.class, () ->
                service.createDomain(principalFor(admin), new CreateDomainRequest("c.com", "C"))).getStatus());

        MailAccount root = account(domainA, "root", MailRole.SUPER_ADMIN, MailAccountStatus.ACTIVE);
        stubActor(root);
        when(domainRepository.existsByName("c.com")).thenReturn(false);
        when(domainRepository.save(any(MailDomain.class))).thenAnswer(inv -> {
            MailDomain d = inv.getArgument(0);
            if (d.getId() == null) d.setId(UUID.randomUUID());
            return d;
        });
        assertEquals("c.com", service.createDomain(principalFor(root),
                new CreateDomainRequest("C.com", "C")).name());
    }
}
