package com.skyzen.careers.mail.service;

import com.skyzen.careers.mail.auth.MailJwtUtil;
import com.skyzen.careers.mail.dto.MailAuthResponse;
import com.skyzen.careers.mail.dto.MailChangePasswordRequest;
import com.skyzen.careers.mail.dto.MailLoginRequest;
import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.entity.MailAccountStatus;
import com.skyzen.careers.mail.entity.MailRefreshToken;
import com.skyzen.careers.mail.exception.MailAuthException;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import com.skyzen.careers.mail.repository.MailRefreshTokenRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

/**
 * Orchestrates mail login / refresh / logout / change-password. Reuses the
 * shared {@code PasswordEncoder} (BCrypt) bean and {@link MailSessionTokenService}
 * for DB-backed rotating refresh tokens. Mirrors Skyzen's {@code AuthService}
 * but mail-scoped and walled by the separate {@link MailJwtUtil} secret.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MailAuthService {

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final MailAccountRepository accountRepository;
    private final MailRefreshTokenRepository refreshTokenRepository;
    private final MailSessionTokenService sessionTokenService;
    private final MailJwtUtil mailJwtUtil;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public MailAuthResponse login(MailLoginRequest req, HttpServletRequest httpRequest) {
        MailAccount account = resolveAccount(req.email());
        if (account == null
                || account.getStatus() != MailAccountStatus.ACTIVE
                || !passwordEncoder.matches(req.password(), account.getPasswordHash())) {
            // One generic message for every failure mode — no enumeration.
            throw new MailAuthException(HttpStatus.UNAUTHORIZED, "Invalid email or password", "MAIL_LOGIN_FAILED");
        }
        MailSessionTokenService.Issued issued = sessionTokenService.issue(account, httpRequest);
        return buildResponse(account, issued);
    }

    @Transactional
    public MailAuthResponse refresh(String rawRefreshToken, HttpServletRequest httpRequest) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new MailAuthException(HttpStatus.UNAUTHORIZED, "Invalid refresh token", "MAIL_REFRESH_INVALID");
        }
        MailRefreshToken row = refreshTokenRepository
                .findByRefreshTokenHash(MailSessionTokenService.hash(rawRefreshToken))
                .orElseThrow(() -> new MailAuthException(
                        HttpStatus.UNAUTHORIZED, "Invalid refresh token", "MAIL_REFRESH_INVALID"));
        MailAccount account = accountRepository.findById(row.getAccountId())
                .orElseThrow(() -> new MailAuthException(
                        HttpStatus.UNAUTHORIZED, "Invalid refresh token", "MAIL_REFRESH_INVALID"));
        if (account.getStatus() != MailAccountStatus.ACTIVE) {
            throw new MailAuthException(HttpStatus.UNAUTHORIZED, "Invalid refresh token", "MAIL_REFRESH_INVALID");
        }
        MailSessionTokenService.Issued issued = sessionTokenService.rotate(account, rawRefreshToken, httpRequest);
        return buildResponse(account, issued);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        sessionTokenService.revoke(rawRefreshToken, "user_logout");
    }

    /**
     * Authenticated self-change. Verifies the current password, sets the new one,
     * clears the must-change flags, invalidates all existing refresh tokens, then
     * issues a FRESH (ungated) token pair so the caller is never locked out.
     */
    @Transactional
    public MailAuthResponse changePassword(UUID accountId, MailChangePasswordRequest req,
                                           HttpServletRequest httpRequest) {
        MailAccount account = accountRepository.findById(accountId)
                .orElseThrow(() -> new MailAuthException(
                        HttpStatus.UNAUTHORIZED, "Account not found", "MAIL_ACCOUNT_NOT_FOUND"));
        if (account.getStatus() != MailAccountStatus.ACTIVE) {
            throw new MailAuthException(HttpStatus.FORBIDDEN, "Account is not active", "MAIL_ACCOUNT_INACTIVE");
        }
        if (!passwordEncoder.matches(req.currentPassword(), account.getPasswordHash())) {
            throw new MailAuthException(HttpStatus.BAD_REQUEST, "Current password is incorrect",
                    "MAIL_BAD_CURRENT_PASSWORD");
        }
        String newPassword = req.newPassword();
        if (newPassword == null || newPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new MailAuthException(HttpStatus.BAD_REQUEST,
                    "New password must be at least " + MIN_PASSWORD_LENGTH + " characters", "MAIL_WEAK_PASSWORD");
        }
        if (passwordEncoder.matches(newPassword, account.getPasswordHash())) {
            throw new MailAuthException(HttpStatus.BAD_REQUEST,
                    "New password must differ from the current password", "MAIL_PASSWORD_UNCHANGED");
        }

        account.setPasswordHash(passwordEncoder.encode(newPassword));
        account.setMustChangePassword(false);
        account.setRequireChangeOnFirstLogin(false);
        accountRepository.save(account);

        // Kill every existing session, then mint a fresh ungated pair.
        sessionTokenService.revokeAllForAccount(account.getId(), "password_changed");
        MailSessionTokenService.Issued issued = sessionTokenService.issue(account, httpRequest);
        log.info("Mail account {} changed password (must-change cleared)", account.getId());
        return buildResponse(account, issued);
    }

    private MailAccount resolveAccount(String email) {
        if (email == null) {
            return null;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        int at = normalized.indexOf('@');
        if (at <= 0 || at == normalized.length() - 1) {
            return null;
        }
        String localPart = normalized.substring(0, at);
        String domainName = normalized.substring(at + 1);
        return accountRepository.findActiveByLocalPartAndDomainName(localPart, domainName).orElse(null);
    }

    private MailAuthResponse buildResponse(MailAccount account, MailSessionTokenService.Issued issued) {
        String accessToken = mailJwtUtil.generateAccessToken(account, issued.token().getId());
        String email = account.getLocalPart() + "@" + account.getDomain().getName();
        return new MailAuthResponse(
                accessToken,
                issued.rawRefreshToken(),
                mailJwtUtil.accessTtlSeconds(),
                account.getId().toString(),
                email,
                account.getDisplayName(),
                account.getRole().name(),
                Boolean.TRUE.equals(account.getMustChangePassword()));
    }
}
