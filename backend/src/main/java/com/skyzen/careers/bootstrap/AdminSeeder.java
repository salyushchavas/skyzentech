package com.skyzen.careers.bootstrap;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.EnumSet;

/**
 * Bootstraps the initial OPERATIONS user from {@code admin.email} /
 * {@code admin.password} properties. Idempotent — skips when any user with
 * the OPERATIONS role already exists.
 *
 * Per PED §7, OPERATIONS holds the former ADMIN superuser powers; there is
 * no separate ADMIN role. Env vars remain {@code ADMIN_EMAIL} /
 * {@code ADMIN_PASSWORD} for backwards-compat with existing Railway config.
 *
 * Body is wrapped in try/catch so a seeding failure logs a WARN and never
 * crashes startup. No class-level {@code @Transactional}: the single save
 * runs in its own short auto-transaction, avoiding the commit-time
 * {@code UnexpectedRollbackException} trap where Spring rolls back after we've
 * caught the underlying JPA exception.
 */
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class AdminSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.email}")
    private String adminEmail;

    @Value("${admin.password}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        try {
            boolean adminExists = userRepository.findAll().stream()
                    .anyMatch(u -> u.getRoles().contains(UserRole.OPERATIONS));
            if (adminExists) {
                return;
            }

            User admin = User.builder()
                    .email(adminEmail)
                    .passwordHash(passwordEncoder.encode(adminPassword))
                    .fullName("Bootstrap Operator")
                    .roles(EnumSet.of(UserRole.OPERATIONS))
                    .build();
            userRepository.save(admin);

            log.warn("Bootstrap OPERATIONS user created — CHANGE PASSWORD IMMEDIATELY "
                    + "in any non-dev environment");
        } catch (Exception e) {
            log.warn("Admin seeder failed (non-fatal): {}", e.getMessage(), e);
        }
    }
}
