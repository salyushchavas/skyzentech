package com.skyzen.careers.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Runs before every other runner and drops Hibernate's auto-generated check
 * constraint on {@code applications.status}. ddl-auto=update never updates
 * existing check constraints, so once a new enum value is added the constraint
 * goes stale and writes to the new value crash. Application-layer enforcement
 * (@Enumerated(EnumType.STRING) + the Java enum) is the real source of truth.
 *
 * Idempotent: {@code DROP CONSTRAINT IF EXISTS} is a no-op after the first
 * successful drop. Never throws — a failure here must not crash startup.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
@Slf4j
public class SchemaFixupRunner implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check");
            log.info("Dropped stale applications_status_check (if present).");
        } catch (Exception e) {
            log.warn("applications_status_check drop failed (non-fatal): {}", e.getMessage(), e);
        }

        // Phase 3 step 5: SECTION_2_PENDING was added to I9Status. ddl-auto
        // never updates the existing CHECK constraint, so we drop it here
        // before any row tries to write the new value. Application-layer
        // @Enumerated(EnumType.STRING) remains the real source of truth.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms DROP CONSTRAINT IF EXISTS i9_forms_status_check");
            log.info("Dropped stale i9_forms_status_check (if present).");
        } catch (Exception e) {
            log.warn("i9_forms_status_check drop failed (non-fatal): {}", e.getMessage(), e);
        }

        // Two-role workflow: TECH_APPROVED + PENDING_VIVA were added to
        // ProjectStatus. Drop the stale CHECK so the existing projects table
        // accepts the new values. Java enum is the source of truth.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check");
            log.info("Dropped stale projects_status_check (if present).");
        } catch (Exception e) {
            log.warn("projects_status_check drop failed (non-fatal): {}", e.getMessage(), e);
        }

        // REPORTING_MANAGER was added to UserRole. The role values live on
        // the user_roles join table; same stale-CHECK reasoning as above.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check");
            log.info("Dropped stale user_roles_role_check (if present).");
        } catch (Exception e) {
            log.warn("user_roles_role_check drop failed (non-fatal): {}", e.getMessage(), e);
        }

        try {
            // Adds the `users.active` column on existing databases. Hibernate's
            // ddl-auto=update can't add a NOT NULL column to a table with rows
            // unless the DDL also supplies a DEFAULT — we do that here before
            // Hibernate's schema validation runs, so existing users keep working.
            // Idempotent: ADD COLUMN IF NOT EXISTS is a no-op the second time.
            jdbcTemplate.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE");
            log.info("Ensured users.active column exists (default TRUE).");
        } catch (Exception e) {
            log.warn("users.active column ensure failed (non-fatal): {}", e.getMessage(), e);
        }

        // Phase 1.2: email-verification gate + Skyzen Applicant ID.
        // Existing rows are backfilled to email_verified=TRUE via the column
        // DEFAULT so they aren't locked out by the new gate. New CANDIDATE
        // registrations are written explicitly with FALSE by the JPA insert.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE");
            jdbcTemplate.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(16)");
            jdbcTemplate.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMP");
            jdbcTemplate.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP");
            jdbcTemplate.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS applicant_id VARCHAR(32) UNIQUE");
            jdbcTemplate.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS applicant_id_created_at TIMESTAMP");
            log.info("Ensured users verification + applicant_id columns exist.");
        } catch (Exception e) {
            log.warn("users verification columns ensure failed (non-fatal): {}", e.getMessage(), e);
        }

        // Sequence backing SKZ-INT-YYYY-NNNNNN. Atomic nextval() under
        // concurrency; CACHE 1 keeps the suffix monotonically increasing
        // across boots even if pre-cached values would otherwise be skipped.
        try {
            jdbcTemplate.execute(
                    "CREATE SEQUENCE IF NOT EXISTS skyzen_applicant_seq START WITH 1 INCREMENT BY 1 CACHE 1");
            log.info("Ensured skyzen_applicant_seq exists.");
        } catch (Exception e) {
            log.warn("skyzen_applicant_seq ensure failed (non-fatal): {}", e.getMessage(), e);
        }

        // Phase 2.2: scorecard dimensions. New columns are nullable (legacy
        // rows pre-2.2 simply won't have a problem-solving score) so the
        // ADD COLUMN IF NOT EXISTS is safe on a populated table.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS feedback_problem_solving_rating INTEGER");
            jdbcTemplate.execute(
                    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS feedback_comments TEXT");
            log.info("Ensured interviews scorecard columns exist.");
        } catch (Exception e) {
            log.warn("interviews scorecard columns ensure failed (non-fatal): {}", e.getMessage(), e);
        }

        // GAP C7 — widen I-9 PII columns to TEXT so the AES-256-GCM ciphertext
        // envelope (base64(IV||ct+tag), ~50-90 bytes per short string) fits.
        // Each ALTER is idempotent under Postgres: TYPE TEXT on an already-TEXT
        // column is a no-op. date_of_birth requires a USING clause because
        // it's a real DATE column being switched to TEXT — Postgres won't
        // implicitly cast DATE -> TEXT.
        //
        // KEY-LOSS WARNING: encrypted columns are unrecoverable without the
        // I9_ENCRYPTION_KEY. Existing plaintext rows will FAIL to decrypt
        // post-rollout — run the I9PlaintextEncryptionMigrator (profile
        // i9-migrate) on environments with data worth keeping, or truncate
        // i9_forms + everify_cases on environments without real data.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms ALTER COLUMN ssn TYPE TEXT");
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms ALTER COLUMN alien_registration_number TYPE TEXT");
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms ALTER COLUMN foreign_passport_number TYPE TEXT");
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms ALTER COLUMN list_a_document_number TYPE TEXT");
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms ALTER COLUMN list_b_document_number TYPE TEXT");
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms ALTER COLUMN list_c_document_number TYPE TEXT");
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms ALTER COLUMN date_of_birth TYPE TEXT "
                            + "USING date_of_birth::text");
            log.info("Ensured i9_forms PII columns are TEXT for AES-256-GCM ciphertext.");
        } catch (Exception e) {
            log.warn("i9_forms PII column widening failed (non-fatal): {}", e.getMessage(), e);
        }
    }
}
