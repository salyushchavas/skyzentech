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
import com.skyzen.careers.enums.InternLifecycleStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.intern.InternLifecycleService;
import com.skyzen.careers.notification.EmailDeliveryException;
import com.skyzen.careers.notification.NotificationStub;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.PasswordResetTokenRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.repository.UserSessionRepository;
import com.skyzen.careers.service.ApplicantIdGenerator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    /**
     * Current ToS / Privacy version stamp. Bump this whenever the legal text
     * meaningfully changes — every fresh registration captures the version
     * the user agreed to at signup.
     */
    private static final String TOS_VERSION = "2026-05-27";

    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final NotificationStub notificationStub;
    private final ApplicantIdGenerator applicantIdGenerator;
    private final SessionTokenService sessionTokenService;
    private final UserSessionRepository userSessionRepository;
    private final InternLifecycleService internLifecycleService;

    /**
     * GAP E3 — dev-only escape hatch for the password-reset token. When
     * {@code app.notification.surface-reset-token=true} (set in dev only) the
     * token is logged at INFO so a developer can copy it without a real email
     * provider. Default FALSE — production log sinks NEVER see a live token.
     * Non-final so @Value field-injection composes with @RequiredArgsConstructor
     * (the Lombok constructor still ignores non-final fields).
     */
    @Value("${app.notification.surface-reset-token:false}")
    private boolean surfaceResetToken;

    /**
     * URL template the password-reset email points at. Must contain a
     * {@code {token}} placeholder; the service substitutes the one-time
     * token at send time.
     */
    @Value("${app.password-reset.url-template:http://localhost:3000/careers/reset-password?token={token}}")
    private String passwordResetUrlTemplate;

    @Transactional
    public AuthResponse register(RegisterRequest req, HttpServletRequest httpRequest) {
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
                .roles(EnumSet.of(UserRole.INTERN))
                .emailVerified(false)
                // Proof of consent — stamped because the @AssertTrue on
                // RegisterRequest.acceptedTos passed validation by the time
                // we reach this point.
                .tosAcceptedAt(now)
                .tosVersion(TOS_VERSION)
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

        // Send verification code. SMTP failure throws — the @Transactional
        // rolls back the user + candidate save so a re-registration starts
        // clean. Never silently swallow a failed verification email (C3).
        try {
            notificationStub.sendVerificationCode(user.getEmail(), code, expiresAt);
        } catch (EmailDeliveryException e) {
            log.error("Verification email send failed during register for {}: {}",
                    user.getEmail(), e.getMessage());
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Couldn't send your verification code. Please try again in a moment.");
        }
        writeAccountAudit(user.getId(), "EMAIL_VERIFICATION_PENDING");
        log.info("User registered: {}", user.getEmail());

        // SECURITY — the verification code is NEVER returned to the client.
        // It rides email only; in dev the LogEmailProvider also writes it to
        // the backend log when surface-stub is on, so developers can read it
        // without an SMTP server, but it never round-trips to the browser.
        return issueSessionResponse(user, httpRequest);
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
            // Heal any stuck lifecycle row (legacy users from before the
            // verifyEmail→advance wiring shipped). advance() is a no-op if
            // they're already past EMAIL_VERIFIED.
            internLifecycleService.advance(
                    user, InternLifecycleStatus.EMAIL_VERIFIED, user.getId());
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

        // Advance lifecycle REGISTERED → EMAIL_VERIFIED so downstream gates
        // (intern dashboard "Verify your email" banner, ApplyModal opening
        // checks, etc.) flip off immediately. advance() is idempotent + a
        // no-op if the user is already past EMAIL_VERIFIED (e.g. they were
        // re-issued a code after applying), so it's safe regardless of the
        // user's current position.
        internLifecycleService.advance(
                user, InternLifecycleStatus.EMAIL_VERIFIED, user.getId());

        // Only CANDIDATEs receive an Applicant ID; staff registrations (when
        // they exist via the admin path) are exempt. The unique DB sequence
        // backing nextApplicantId() guarantees the ID is collision-free even
        // under concurrent verifications.
        String applicantId = user.getApplicantId();
        if (applicantId == null && user.getRoles() != null
                && user.getRoles().contains(UserRole.INTERN)) {
            // Applicant IDs are issued only on the first email verification of
            // a freshly-registered APPLICANT. Once they're hired they become
            // INTERN — by then they already carry an applicantId from this
            // initial pass, so we don't include INTERN in the gate.
            applicantId = applicantIdGenerator.nextApplicantId();
            user.setApplicantId(applicantId);
            user.setApplicantIdCreatedAt(Instant.now());
            // Best-effort — the ID assignment is the source of truth; an email
            // hiccup must not block the verification flow.
            try {
                notificationStub.sendApplicantIdIssued(user.getEmail(), applicantId);
            } catch (EmailDeliveryException e) {
                log.warn("Applicant ID email failed (non-fatal) for {}: {}",
                        user.getEmail(), e.getMessage());
            }
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

        // Resend: same retryable-error semantics as register. The code change
        // is persisted; throwing here just stops the response from claiming
        // success when no email actually went out.
        try {
            notificationStub.sendVerificationCode(user.getEmail(), code, expiresAt);
        } catch (EmailDeliveryException e) {
            log.error("Verification email resend failed for {}: {}",
                    user.getEmail(), e.getMessage());
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Couldn't send your verification code. Please try again in a moment.");
        }
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

    public AuthResponse login(LoginRequest req, HttpServletRequest httpRequest) {
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
        return issueSessionResponse(user, httpRequest);
    }

    /**
     * Refresh-token rotation. Validates the presented refresh token against a
     * non-revoked, non-expired session, then rotates (revokes the old row,
     * issues a fresh access+refresh pair). Used by the frontend's auto-refresh
     * on 401.
     */
    @Transactional
    public AuthResponse refresh(String refreshToken, HttpServletRequest httpRequest) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }
        String hash = SessionTokenService.hash(refreshToken);
        com.skyzen.careers.entity.UserSession session = userSessionRepository
                .findByRefreshTokenHash(hash)
                .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED,
                        "Invalid refresh token"));
        User user = userRepository.findById(session.getUserId())
                .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED,
                        "Invalid refresh token"));
        if (Boolean.FALSE.equals(user.getActive())) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }
        SessionTokenService.Issued issued = sessionTokenService.rotate(user, refreshToken, httpRequest);
        return buildAuthResponse(user, issued);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest req) {
        Optional<User> userOpt = userRepository.findByEmail(req.email());
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            String token = UUID.randomUUID().toString();
            Instant expiresAt = Instant.now().plusSeconds(RESET_TOKEN_TTL_SECONDS);
            PasswordResetToken prt = PasswordResetToken.builder()
                    .userId(user.getId())
                    .token(token)
                    .expiresAt(expiresAt)
                    .used(false)
                    .build();
            passwordResetTokenRepository.save(prt);

            // GAP E3 — gated dev-only echo. Default config keeps this OFF so
            // prod log sinks never see a live token. Dev sets
            // app.notification.surface-reset-token=true to retrieve it.
            if (surfaceResetToken) {
                log.info("DEV ONLY — password reset token for {}: {}",
                        req.email(), token);
            }

            // C3 — actually email the reset link. Best-effort: a delivery
            // failure must not surface a different response to the caller
            // (that would leak account existence). The token row is the
            // source of truth; the user can retry via /forgot-password.
            String resetUrl = passwordResetUrlTemplate.replace("{token}", token);
            try {
                notificationStub.sendPasswordReset(user.getEmail(), resetUrl, expiresAt);
            } catch (EmailDeliveryException e) {
                log.error("Password-reset email failed for {}: {}",
                        user.getEmail(), e.getMessage());
            }
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
        // Phase 3 step 6 — surface expectedTrack so the candidate sidebar can
        // hide non-STEM-OPT-only tiles (I-983 Training Plan). Only candidates
        // have a Candidate row; staff users return null here.
        String expectedTrack = candidateRepository.findByUserId(user.getId())
                .map(c -> c.getExpectedTrack() != null
                        ? c.getExpectedTrack().name()
                        : null)
                .orElse(null);
        return new MeResponse(
                user.getId().toString(),
                user.getEmail(),
                user.getFullName(),
                user.getPhoneNumber(),
                roles,
                user.getCreatedAt(),
                user.getEmailVerified(),
                user.getApplicantId(),
                expectedTrack
        );
    }

    /**
     * Create a fresh session + bind a freshly-signed access token to it.
     * Used by login + register; the refresh path uses {@link #buildAuthResponse}
     * directly off a rotated session.
     */
    private AuthResponse issueSessionResponse(User user, HttpServletRequest httpRequest) {
        SessionTokenService.Issued issued = sessionTokenService.issueSession(
                user, httpRequest, "login");
        return buildAuthResponse(user, issued);
    }

    private AuthResponse buildAuthResponse(User user, SessionTokenService.Issued issued) {
        String accessToken = jwtUtil.generateAccessToken(user, issued.session().getId());
        List<String> roles = user.getRoles().stream().map(Enum::name).toList();
        return new AuthResponse(
                accessToken,
                issued.rawRefreshToken(),
                jwtUtil.accessTtlSeconds(),
                user.getId().toString(),
                user.getEmail(),
                user.getFullName(),
                roles,
                user.getEmailVerified(),
                user.getApplicantId()
        );
    }
}
