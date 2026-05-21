package com.skyzen.careers.auth;

import com.skyzen.careers.auth.dto.AuthResponse;
import com.skyzen.careers.auth.dto.ForgotPasswordRequest;
import com.skyzen.careers.auth.dto.LoginRequest;
import com.skyzen.careers.auth.dto.MeResponse;
import com.skyzen.careers.auth.dto.RegisterRequest;
import com.skyzen.careers.auth.dto.ResetPasswordRequest;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.PasswordResetToken;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.PasswordResetTokenRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final long RESET_TOKEN_TTL_SECONDS = 60L * 60L;

    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new AuthException(HttpStatus.CONFLICT, "Email already registered");
        }

        User user = User.builder()
                .email(req.email())
                .passwordHash(passwordEncoder.encode(req.password()))
                .fullName(req.fullName())
                .phoneNumber(req.phoneNumber())
                .roles(EnumSet.of(UserRole.CANDIDATE))
                .build();
        userRepository.save(user);

        Candidate candidate = Candidate.builder()
                .user(user)
                .build();
        candidateRepository.save(candidate);

        log.info("User registered: {}", user.getEmail());
        return toAuthResponse(user);
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
                user.getCreatedAt()
        );
    }

    private AuthResponse toAuthResponse(User user) {
        String token = jwtUtil.generateToken(user);
        List<String> roles = user.getRoles().stream().map(Enum::name).toList();
        return new AuthResponse(
                token,
                user.getId().toString(),
                user.getEmail(),
                user.getFullName(),
                roles
        );
    }
}
