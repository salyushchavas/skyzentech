package com.skyzen.careers.bootstrap;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

/**
 * Seeds one test user per role with known credentials so every role on the
 * 8-role taxonomy is testable from a single consistent credential set.
 *
 * <h2>Idempotent</h2>
 * Looked up by email (case-insensitive via the underlying findByEmail). If a
 * user with the same email exists — regardless of role — the row is left
 * untouched. Re-running the seeder is therefore safe; existing accounts are
 * never overwritten.
 *
 * <h2>Gated</h2>
 * Off by default. Enable via {@code app.bootstrap.seed-test-role-users-enabled=true}
 * (or env {@code APP_BOOTSTRAP_SEED_TEST_ROLE_USERS_ENABLED=true}). NEVER
 * enable in production — the credentials below are documented in the source
 * tree and commit history.
 *
 * <h2>Test users</h2>
 * <pre>
 *   test-applicant@skyzen.test   Applicant@1   APPLICANT
 *   test-intern@skyzen.test      Intern@1      INTERN
 *   test-hr@skyzen.test          Hr@1234       HR
 *   test-ops@skyzen.test         Ops@1234      OPERATIONS
 *   test-eval@skyzen.test        Eval@1234     TECHNICAL_EVALUATOR
 *   test-rm@skyzen.test          Rm@1234       REPORTING_MANAGER
 *   test-exec@skyzen.test        Exec@1234     EXECUTIVE
 *   test-admin@skyzen.test       Admin@1234    SUPER_ADMIN
 * </pre>
 *
 * <h2>Note on intern testing</h2>
 * The seeded {@code test-intern@skyzen.test} is a plain INTERN account with
 * no engagement. End-to-end intern workflows (timesheets, weekly reports,
 * project allocation) require an ACTIVE engagement — use the upstream-chain
 * builder in {@link TestAccountSeeder} (which seeds the same email with a
 * full engagement) or run the existing
 * {@code TestUserPromotionRunner} against {@code abhizoe5+test5@gmail.com}.
 */
@Component
@Order(20)
@RequiredArgsConstructor
@Slf4j
public class TestRoleUserSeeder implements ApplicationRunner {

    private static final String LOG_TAG = "[TestRoleUserSeeder]";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap.seed-test-role-users-enabled:false}")
    private boolean enabled;

    private record TestRoleUser(
            String email,
            String password,
            String fullName,
            UserRole role
    ) {}

    private static final List<TestRoleUser> TEST_USERS = List.of(
            new TestRoleUser("test-applicant@skyzen.test", "Applicant@1", "Test Applicant", UserRole.APPLICANT),
            new TestRoleUser("test-intern@skyzen.test",    "Intern@1",    "Test Intern",    UserRole.INTERN),
            new TestRoleUser("test-hr@skyzen.test",        "Hr@1234",     "Test HR",        UserRole.HR),
            new TestRoleUser("test-ops@skyzen.test",       "Ops@1234",    "Test Ops",       UserRole.OPERATIONS),
            new TestRoleUser("test-eval@skyzen.test",      "Eval@1234",   "Test Evaluator", UserRole.TECHNICAL_EVALUATOR),
            new TestRoleUser("test-rm@skyzen.test",        "Rm@1234",     "Test RM",        UserRole.REPORTING_MANAGER),
            new TestRoleUser("test-exec@skyzen.test",      "Exec@1234",   "Test Exec",      UserRole.EXECUTIVE),
            new TestRoleUser("test-admin@skyzen.test",     "Admin@1234",  "Test Admin",     UserRole.SUPER_ADMIN)
    );

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.info("{} skipped — disabled", LOG_TAG);
            return;
        }
        int scanned = 0, created = 0, skipped = 0, failed = 0;
        for (TestRoleUser tu : TEST_USERS) {
            scanned++;
            try {
                Optional<User> existing = userRepository.findByEmail(tu.email());
                if (existing.isPresent()) {
                    User u = existing.get();
                    boolean hasExpected = u.getRoles() != null
                            && u.getRoles().contains(tu.role());
                    if (hasExpected) {
                        log.info("{} email {} already exists with role {} — skipping",
                                LOG_TAG, tu.email(), tu.role());
                    } else {
                        log.warn("{} email {} exists with role(s) {}, expected {} "
                                        + "— skipping (manual reconcile required)",
                                LOG_TAG, tu.email(), u.getRoles(), tu.role());
                    }
                    skipped++;
                    continue;
                }
                User u = User.builder()
                        .email(tu.email())
                        .passwordHash(passwordEncoder.encode(tu.password()))
                        .fullName(tu.fullName())
                        .roles(EnumSet.of(tu.role()))
                        .emailVerified(true)
                        .active(true)
                        .build();
                userRepository.save(u);
                created++;
                log.warn("{} CREATED {} / {} (role={}) — for non-production testing only",
                        LOG_TAG, tu.email(), tu.password(), tu.role());
            } catch (Exception e) {
                failed++;
                log.warn("{} CREATE failed for {} (role={}): {}",
                        LOG_TAG, tu.email(), tu.role(), e.getMessage(), e);
            }
        }
        log.info("{} done — scanned={} created={} skipped_existing={} failed={}",
                LOG_TAG, scanned, created, skipped, failed);
    }
}
