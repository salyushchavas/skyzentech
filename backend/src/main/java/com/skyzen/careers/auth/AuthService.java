package com.skyzen.careers.auth;

import com.skyzen.careers.auth.dto.AuthResponse;
import com.skyzen.careers.auth.dto.ForgotPasswordRequest;
import com.skyzen.careers.auth.dto.LoginRequest;
import com.skyzen.careers.auth.dto.MeResponse;
import com.skyzen.careers.auth.dto.RegisterRequest;
import com.skyzen.careers.auth.dto.ResendVerificationRequest;
import com.skyzen.careers.auth.dto.ResetPasswordRequest;
import com.skyzen.careers.auth.dto.VerifyEmailRequest;
import com.skyzen.careers.auth.dto.VerifyEmailResponse;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.PasswordResetToken;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.notification.NotificationStub;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.PasswordResetTokenRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.service.ApplicantIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final long RESET_TOKEN_TTL_SECONDS = 60L * 60L;
    private static final long VERIFICATION_CODE_TTL_HOURS = 24L;
    private static final SecureRandom RNG = new SecureRandom();

    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final NotificationStub notificationStub;
    private final ApplicantIdGenerator applicantIdGenerator;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new AuthException(HttpStatus.CONFLICT, "Email already registered");
        }

        String code = generateVerificationCode();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(VERIFICATION_CODE_TTL_HOURS, ChronoUnit.HOURS);

        User user = User.builder()
                .email(req.email())
                .passwordHash(passwordEncoder.encode(req.password()))
                .fullName(req.fullName())
                .phoneNumber(req.phoneNumber())
                .roles(EnumSet.of(UserRole.CANDIDATE))
                .emailVerified(false)
                .emailVerificationCode(code)
                .emailVerificationSentAt(now)
                .emailVerificationExpiresAt(expiresAt)
                .build();
        userRepository.save(user);

        // Phase 1.4 — persist whatever intake + attestation values the
        // registration form sent. Each field is null-tolerant; the profile
        // page is the primary edit surface, registration just captures what
        // the candidate volunteered up-front.
        Candidate candidate = Candidate.builder()
                .user(user)
                .legalName(emptyToNull(req.legalName()))
                .preferredName(emptyToNull(req.preferredName()))
                .education(emptyToNull(req.education()))
                .school(emptyToNull(req.school()))
                .degree(emptyToNull(req.degree()))
                .skillset(emptyToNull(req.skillset()))
                .authorizedToWork(req.authorizedToWork())
                .sponsorshipNeeded(req.sponsorshipNeeded())
                .expectedTrack(req.expectedTrack())
                .validityDate(req.validityDate())
                .build();
        candidateRepository.save(candidate);

        notificationStub.sendVerificationCode(user.getEmail(), code, expiresAt);
        writeAccountAudit(user.getId(), "EMAIL_VERIFICATION_PENDING");
        log.info("User registered: {}", user.getEmail());

        // dev-mode echo of the code so the frontend can prefill the verify
        // screen; gated by app.notification.surface-stub (default true, prod false).
        String surfacedCode = notificationStub.shouldSurfaceStub() ? code : null;
        return toAuthResponse(user, surfacedCode);
    }

    /**
     * Validate a 6-digit verification code, flip the user to verified, and —
     * for CANDIDATE accounts that don't already have one — issue a Skyzen
     * Applicant ID atomically. Idempotent: re-verifying an already-verified
     * user returns success without re-issuing an ID. Audits
     * EMAIL_VERIFIED and (when issued) APPLICANT_ID_CREATED.
     */
    @Transactional
    public VerifyEmailResponse verifyEmail(VerifyEmailRequest req) {
        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new AuthException(HttpStatus.BAD_REQUEST,
                        "Invalid email or verification code"));

        if (Boolean.TRUE.equals(user.getEmailVerified())) {
            // Already verified — return a no-op success with their existing ID.
            return new VerifyEmailResponse(true, user.getApplicantId(),
                    "Email already verified");
        }

        String storedCode = user.getEmailVerificationCode();
        Instant expiresAt = user.getEmailVerificationExpiresAt();
        if (storedCode == null || !storedCode.equals(req.code())) {
            throw new AuthException(HttpStatus.BAD_REQUEST,
                    "Invalid email or verification code");
        }
        if (expiresAt != null && expiresAt.isBefore(Instant.now())) {
            throw new AuthException(HttpStatus.BAD_REQUEST,
                    "Verification code has expired — request a new one");
        }

        user.setEmailVerified(true);
        user.setEmailVerificationCode(null);
        user.setEmailVerificationSentAt(null);
        user.setEmailVerificationExpiresAt(null);
        writeAccountAudit(user.getId(), "EMAIL_VERIFIED");

        // Only CANDIDATEs receive an Applicant ID; staff registrations (when
        // they exist via the admin path) are exempt. The unique DB sequence
        // backing nextApplicantId() guarantees the ID is collision-free even
        // under concurrent verifications.
        String applicantId = user.getApplicantId();
        if (applicantId == null && user.getRoles() != null
                && user.getRoles().contains(UserRole.CANDIDATE)) {
            applicantId = applicantIdGenerator.nextApplicantId();
            user.setApplicantId(applicantId);
            user.setApplicantIdCreatedAt(Instant.now());
            notificationStub.sendApplicantIdIssued(user.getEmail(), applicantId);
            writeAccountAudit(user.getId(), "APPLICANT_ID_CREATED");
        }
        userRepository.save(user);

        return new VerifyEmailResponse(true, applicantId, "Email verified");
    }

    /**
     * Re-issue a fresh code + sentAt + expiresAt and stub-send it. Idempotent
     * — if the account is already verified we return without changing state.
     * To avoid revealing account existence to scanners, an unknown email
     * silently no-ops.
     */
    @Transactional
    public void resendVerification(ResendVerificationRequest req) {
        Optional<User> userOpt = userRepository.findByEmail(req.email());
        if (userOpt.isEmpty()) {
            // Don't reveal whether the email exists.
            return;
        }
        User user = userOpt.get();
        if (Boolean.TRUE.equals(user.getEmailVerified())) {
            return;
        }
        String code = generateVerificationCode();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(VERIFICATION_CODE_TTL_HOURS, ChronoUnit.HOURS);
        user.setEmailVerificationCode(code);
        user.setEmailVerificationSentAt(now);
        user.setEmailVerificationExpiresAt(expiresAt);
        userRepository.save(user);

        notificationStub.sendVerificationCode(user.getEmail(), code, expiresAt);
        writeAccountAudit(user.getId(), "EMAIL_VERIFICATION_RESENT");
    }

    private String generateVerificationCode() {
        // 000000 - 999999, zero-padded so it's always 6 chars on the wire.
        return String.format("%06d", RNG.nextInt(1_000_000));
    }

    /**
     * Treat an empty/whitespace-only string as null so intake fields the user
     * left blank don't show up as " " or "" rows in the DB. JSON deserialisation
     * keeps explicit nulls null already; this only handles the empty-string case.
     */
    private static String emptyToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void writeAccountAudit(UUID userId, String action) {
        AuditLog row = AuditLog.builder()
                .userId(userId)
                .entityType("User")
                .entityId(userId)
                .action(action)
                .build();
        auditLogRepository.save(row);
    }

    public AuthResponse login(LoginRequest req) {
        Optional<User> userOpt = userRepository.findByEmail(req.email());
        if (userOpt.isEmpty() || !passwordEncoder.matches(req.password(), userOpt.get().getPasswordHash())) {
            log.warn("Failed login attempt for email: {}", req.email());
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        User user = userOpt.get();
        // Reject deactivated accounts at the login boundary. We use 401 rather
        // than 403 so a deactivated account behaves the same as a wrong-password
        // attempt — clients don't get an oracle that distinguishes "real account"
        // from "real account, just locked".
        if (Boolean.FALSE.equals(user.getActive())) {
            log.warn("Login blocked for deactivated user: {}", user.getEmail());
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        log.info("User logged in: {}", user.getEmail());
        return toAuthResponse(user);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest req) {
        Optional<User> userOpt = userRepository.findByEmail(req.email());
        if (userOpt.isPresent()) {
            String token = UUID.randomUUID().toString();
            PasswordResetToken prt = PasswordResetToken.builder()
                    .userId(userOpt.get().getId())
                    .token(token)
                    .expiresAt(Instant.now().plusSeconds(RESET_TOKEN_TTL_SECONDS))
                    .used(false)
                    .build();
            passwordResetTokenRepository.save(prt);
            log.info("DEV ONLY — password reset token for {}: {}", req.email(), token);
        }
        // Always returns success at the controller level — do not reveal account existence.
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        PasswordResetToken prt = passwordResetTokenRepository.findByToken(req.token())
                .orElseThrow(() -> new AuthException(HttpStatus.BAD_REQUEST, "Invalid or expired token"));

        if (Boolean.TRUE.equals(prt.getUsed()) || prt.getExpiresAt().isBefore(Instant.now())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Invalid or expired token");
        }

        User user = userRepository.findById(prt.getUserId())
                .orElseThrow(() -> new AuthException(HttpStatus.BAD_REQUEST, "Invalid or expired token"));

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);

        prt.setUsed(true);
        passwordResetTokenRepository.save(prt);

        log.info("Password reset completed for user: {}", user.getEmail());
    }

    public MeResponse me(User user) {
        List<String> roles = user.getRoles().stream().map(Enum::name).toList();
        return new MeResponse(
                user.getId().toString(),
                user.getEmail(),
                user.getFullName(),
                user.getPhoneNumber(),
                roles,
                user.getCreatedAt(),
                user.getEmailVerified(),
                user.getApplicantId()
        );
    }

    private AuthResponse toAuthResponse(User user) {
        return toAuthResponse(user, null);
    }

    private AuthResponse toAuthResponse(User user, String surfacedVerificationCode) {
        String token = jwtUtil.generateToken(user);
        List<String> roles = user.getRoles().stream().map(Enum::name).toList();
        return new AuthResponse(
                token,
                user.getId().toString(),
                user.getEmail(),
                user.getFullName(),
                roles,
                user.getEmailVerified(),
                user.getApplicantId(),
                surfacedVerificationCode
        );
    }
}
