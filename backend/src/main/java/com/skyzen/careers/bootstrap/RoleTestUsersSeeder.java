package com.skyzen.careers.bootstrap;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.List;

/**
 * Creates one test user per non-admin role on first boot so the demo can log in
 * as each role and see the role-specific dashboard. Idempotent — if a user with
 * the seeded email already exists, that account is left untouched (no password
 * reset, no role rewrite).
 *
 * Demo-only. Remove or guard with a profile flag before any non-dev deploy.
 */
@Component
@Profile("!prod") // GAP E4 — demo test users; never seeded in production.
@Order(3)
@RequiredArgsConstructor
@Slf4j
public class RoleTestUsersSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private record TestUser(String email, String password, String fullName, UserRole role) {}

    private static final List<TestUser> TEST_USERS = List.of(
            new TestUser("recruiter@skyzen.test", "recruiter12345", "Demo Recruiter", UserRole.RECRUITER),
            new TestUser("erm@skyzen.test", "erm12345", "Demo ERM", UserRole.ERM),
            new TestUser("hr@skyzen.test", "hr12345", "Demo HR Compliance", UserRole.HR_COMPLIANCE),
            new TestUser("evaluator@skyzen.test", "evaluator12345", "Demo Technical Evaluator", UserRole.TECHNICAL_EVALUATOR)
    );

    @Override
    public void run(String... args) {
        try {
            int created = 0;
            for (TestUser tu : TEST_USERS) {
                if (userRepository.existsByEmail(tu.email())) continue;
                User user = User.builder()
                        .email(tu.email())
                        .passwordHash(passwordEncoder.encode(tu.password()))
                        .fullName(tu.fullName())
                        .roles(EnumSet.of(tu.role()))
                        .build();
                userRepository.save(user);
                created++;
                log.warn("Demo {} user created — {} / {} (change in any non-dev environment)",
                        tu.role(), tu.email(), tu.password());
            }
            if (created == 0) {
                log.info("Demo role test users already present — skipping seed");
            }
        } catch (Exception e) {
            log.warn("Role test users seeder failed (non-fatal): {}", e.getMessage(), e);
        }
    }
}
