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

        // ── 8-role finalize: rename HR_COMPLIANCE → HR and
        //                    TECHNICAL_SUPERVISOR → TECHNICAL_EVALUATOR.
        //
        // Idempotent: subsequent boots find zero matching rows. The CHECK
        // drop above must run first so the new values aren't rejected.
        // Each UPDATE is wrapped in its own try/catch so a missing table /
        // column on some deployment doesn't crash startup.
        try {
            int n = jdbcTemplate.update(
                    "UPDATE user_roles SET role = 'HR' WHERE role = 'HR_COMPLIANCE'");
            if (n > 0) log.info("[SchemaFixupRunner] role rename: {} user_roles rows updated "
                    + "HR_COMPLIANCE → HR", n);
        } catch (Exception e) {
            log.warn("[SchemaFixupRunner] role rename UPDATE skipped (HR_COMPLIANCE → HR): {}",
                    e.getMessage());
        }
        try {
            int n = jdbcTemplate.update(
                    "UPDATE user_roles SET role = 'TECHNICAL_EVALUATOR' "
                            + "WHERE role = 'TECHNICAL_SUPERVISOR'");
            if (n > 0) log.info("[SchemaFixupRunner] role rename: {} user_roles rows updated "
                    + "TECHNICAL_SUPERVISOR → TECHNICAL_EVALUATOR", n);
        } catch (Exception e) {
            log.warn("[SchemaFixupRunner] role rename UPDATE skipped "
                    + "(TECHNICAL_SUPERVISOR → TECHNICAL_EVALUATOR): {}", e.getMessage());
        }
        // Defensive: any deployment that stored roles on a single users.role
        // column (rather than the join table) gets the same rename.
        try {
            int n = jdbcTemplate.update(
                    "UPDATE users SET role = 'HR' WHERE role = 'HR_COMPLIANCE'");
            if (n > 0) log.info("[SchemaFixupRunner] role rename: {} users.role rows updated "
                    + "HR_COMPLIANCE → HR", n);
        } catch (Exception e) {
            // Expected on the join-table schema (no users.role column).
            log.debug("[SchemaFixupRunner] users.role HR rename skipped: {}", e.getMessage());
        }
        try {
            int n = jdbcTemplate.update(
                    "UPDATE users SET role = 'TECHNICAL_EVALUATOR' "
                            + "WHERE role = 'TECHNICAL_SUPERVISOR'");
            if (n > 0) log.info("[SchemaFixupRunner] role rename: {} users.role rows updated "
                    + "TECHNICAL_SUPERVISOR → TECHNICAL_EVALUATOR", n);
        } catch (Exception e) {
            log.debug("[SchemaFixupRunner] users.role TECHNICAL_EVALUATOR rename skipped: {}",
                    e.getMessage());
        }

        // Workspace submissions — drop the auto-generated CHECK on
        // review_outcome so future ReviewOutcome additions don't trip the
        // stale-CHECK trap. Idempotent.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE workspace_submissions "
                            + "DROP CONSTRAINT IF EXISTS workspace_submissions_review_outcome_check");
            log.info("Dropped stale workspace_submissions_review_outcome_check (if present).");
        } catch (Exception e) {
            log.warn("workspace_submissions_review_outcome_check drop failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        // Q&A sessions — drop the auto-generated CHECK on status so future
        // QaSessionStatus additions don't trip the stale-CHECK trap.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE qa_sessions DROP CONSTRAINT IF EXISTS qa_sessions_status_check");
            log.info("Dropped stale qa_sessions_status_check (if present).");
        } catch (Exception e) {
            log.warn("qa_sessions_status_check drop failed (non-fatal): {}", e.getMessage(), e);
        }

        // sent_notifications.event_type was created varchar(20) on the legacy
        // schema; the entity now declares length = 64 but ddl-auto never
        // widens an existing column. The longest enum name today is
        // PROJECT_RETURNED_FOR_REVISIONS (30 chars); shorter values like
        // I9_SECTION2_PENDING fit varchar(20) by one byte but trip the
        // overflow during I-9 Section 1 commit because the row write fails
        // before the column is widened. Idempotent: ALTER ... TYPE on an
        // already-varchar(64) column is a no-op.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE sent_notifications ALTER COLUMN event_type TYPE varchar(64)");
            log.info("Ensured sent_notifications.event_type is varchar(64).");
        } catch (Exception e) {
            log.warn("sent_notifications.event_type widen failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        // sent_notifications — drop the auto-generated CHECK on event_type so
        // post-batch-1 additions (I9_SECTION2_PENDING, the workspace events,
        // workauth expiry buckets, …) write cleanly. Java enum is the source
        // of truth; the CHECK is dead weight.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE sent_notifications "
                            + "DROP CONSTRAINT IF EXISTS sent_notifications_event_type_check");
            log.info("Dropped stale sent_notifications_event_type_check (if present).");
        } catch (Exception e) {
            log.warn("sent_notifications_event_type_check drop failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        // i9_forms.status — defensive widening to varchar(32). The current
        // longest I9Status value (SECTION_1_COMPLETE, 18 chars) fits the
        // legacy varchar(20), but we widen pre-emptively so adding a longer
        // status (e.g. a new SECTION_3_*) later doesn't hit the same
        // ddl-auto-can't-widen trap that bit sent_notifications.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms ALTER COLUMN status TYPE varchar(32)");
            log.info("Ensured i9_forms.status is varchar(32).");
        } catch (Exception e) {
            log.warn("i9_forms.status widen failed (non-fatal): {}", e.getMessage(), e);
        }

        // i9_forms.citizenship_status — the @Column had no explicit length so
        // the legacy schema created it as varchar(20). Two CitizenshipStatus
        // values exceed that: LAWFUL_PERMANENT_RESIDENT (25 chars) and
        // ALIEN_AUTHORIZED_TO_WORK (24 chars). Writing either triggers
        // "value too long for type character varying(20)" on the I-9 Section 1
        // commit, marking the transaction rollback-only. Widen to varchar(32).
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE i9_forms ALTER COLUMN citizenship_status TYPE varchar(32)");
            log.info("Ensured i9_forms.citizenship_status is varchar(32).");
        } catch (Exception e) {
            log.warn("i9_forms.citizenship_status widen failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        // ── Project Catalog + Assignment module ────────────────────────────
        //
        // Additive — the new Project Catalog model adds catalog columns to
        // the existing projects table and a new project_assignments table.
        // Legacy intern_id/status/due_date columns on projects are LEFT IN
        // PLACE so the workspace + submission + project-workflow paths keep
        // working unchanged.

        try {
            jdbcTemplate.execute(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS name VARCHAR(200)");
            jdbcTemplate.execute(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS tech_stack VARCHAR(500)");
            jdbcTemplate.execute(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20)");
            jdbcTemplate.execute(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_duration_days INTEGER");
            jdbcTemplate.execute(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS instructions TEXT");
            jdbcTemplate.execute(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_id UUID");
            log.info("Ensured projects catalog columns exist (name, tech_stack, "
                    + "difficulty, expected_duration_days, instructions, created_by_id).");
        } catch (Exception e) {
            log.warn("projects catalog-columns ensure failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        try {
            jdbcTemplate.execute(
                    "CREATE TABLE IF NOT EXISTS project_assignments ("
                            + "  id UUID PRIMARY KEY,"
                            + "  project_id UUID NOT NULL,"
                            + "  intern_id UUID NOT NULL,"
                            + "  assigned_by_id UUID NOT NULL,"
                            + "  assignment_date DATE NOT NULL,"
                            + "  due_date DATE,"
                            + "  notes TEXT,"
                            + "  status VARCHAR(40) NOT NULL DEFAULT 'ASSIGNED',"
                            + "  created_at TIMESTAMP NOT NULL DEFAULT NOW(),"
                            + "  updated_at TIMESTAMP NOT NULL DEFAULT NOW()"
                            + ")");
            jdbcTemplate.execute(
                    "CREATE INDEX IF NOT EXISTS idx_pa_intern "
                            + "ON project_assignments(intern_id)");
            jdbcTemplate.execute(
                    "CREATE INDEX IF NOT EXISTS idx_pa_project "
                            + "ON project_assignments(project_id)");
            jdbcTemplate.execute(
                    "CREATE INDEX IF NOT EXISTS idx_pa_assigned_by "
                            + "ON project_assignments(assigned_by_id)");
            log.info("Ensured project_assignments table + indexes exist.");
        } catch (Exception e) {
            log.warn("project_assignments table ensure failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        // Backfill — for each legacy projects row that has an intern_id but
        // no matching project_assignments row, mint one. Idempotent via the
        // NOT EXISTS guard. Translates the legacy ProjectStatus values to
        // the equivalent ProjectAssignmentStatus enum names (the assignment
        // enum was deliberately defined with the same upstream values).
        try {
            int inserted = jdbcTemplate.update(
                    "INSERT INTO project_assignments "
                            + "  (id, project_id, intern_id, assigned_by_id, "
                            + "   assignment_date, due_date, notes, status, "
                            + "   created_at, updated_at) "
                            + "SELECT gen_random_uuid(), p.id, c.user_id, p.assigned_by, "
                            + "       COALESCE(p.start_date, CURRENT_DATE), "
                            + "       p.due_date, NULL, "
                            + "       COALESCE(p.status, 'ASSIGNED'), "
                            + "       COALESCE(p.created_at, NOW()), "
                            + "       COALESCE(p.updated_at, NOW()) "
                            + "FROM projects p "
                            + "JOIN candidates c ON c.id = p.intern_id "
                            + "WHERE p.intern_id IS NOT NULL "
                            + "  AND c.user_id IS NOT NULL "
                            + "  AND p.assigned_by IS NOT NULL "
                            + "  AND NOT EXISTS ("
                            + "    SELECT 1 FROM project_assignments pa "
                            + "    WHERE pa.project_id = p.id AND pa.intern_id = c.user_id"
                            + "  )");
            if (inserted > 0) {
                log.info("Backfilled {} legacy projects → project_assignments rows.",
                        inserted);
            }
        } catch (Exception e) {
            log.warn("project_assignments backfill failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        // ── Project Catalog + Assignment module — repository link table ────
        //
        // Company-owned-repository model: one GitHub repo per Project,
        // shared by every assigned intern. Schema is additive — no impact
        // on the legacy single-allocation paths or workspace.
        try {
            jdbcTemplate.execute(
                    "CREATE TABLE IF NOT EXISTS project_repositories ("
                            + "  id UUID PRIMARY KEY,"
                            + "  project_id UUID NOT NULL UNIQUE,"
                            + "  repository_name VARCHAR(200) NOT NULL,"
                            + "  repository_url VARCHAR(500) NOT NULL,"
                            + "  github_repository_id VARCHAR(100),"
                            + "  linked_by_id UUID NOT NULL,"
                            + "  created_at TIMESTAMP NOT NULL DEFAULT NOW(),"
                            + "  updated_at TIMESTAMP NOT NULL DEFAULT NOW()"
                            + ")");
            jdbcTemplate.execute(
                    "CREATE INDEX IF NOT EXISTS idx_pr_project "
                            + "ON project_repositories(project_id)");
            log.info("Ensured project_repositories table + index exist.");
        } catch (Exception e) {
            log.warn("project_repositories table ensure failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        // Project catalog text fields the repository-owned-by-project model
        // adds on top of the prior catalog migration.
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS requirements TEXT");
            jdbcTemplate.execute(
                    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS objectives TEXT");
            log.info("Ensured projects.requirements + projects.objectives columns exist.");
        } catch (Exception e) {
            log.warn("projects requirements/objectives ensure failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        // Assignment lifecycle columns — access-granted tracking + start /
        // submit timestamps + the renamed `remarks` column (the legacy
        // `notes` column is left in place for back-compat reads).
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE project_assignments "
                            + "ADD COLUMN IF NOT EXISTS remarks TEXT");
            jdbcTemplate.execute(
                    "ALTER TABLE project_assignments "
                            + "ADD COLUMN IF NOT EXISTS access_granted BOOLEAN "
                            + "NOT NULL DEFAULT FALSE");
            jdbcTemplate.execute(
                    "ALTER TABLE project_assignments "
                            + "ADD COLUMN IF NOT EXISTS access_granted_at TIMESTAMP");
            jdbcTemplate.execute(
                    "ALTER TABLE project_assignments "
                            + "ADD COLUMN IF NOT EXISTS access_granted_by_id UUID");
            jdbcTemplate.execute(
                    "ALTER TABLE project_assignments "
                            + "ADD COLUMN IF NOT EXISTS started_at TIMESTAMP");
            jdbcTemplate.execute(
                    "ALTER TABLE project_assignments "
                            + "ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP");
            jdbcTemplate.execute(
                    "ALTER TABLE project_assignments "
                            + "ADD COLUMN IF NOT EXISTS submission_notes TEXT");
            log.info("Ensured project_assignments lifecycle columns exist.");
        } catch (Exception e) {
            log.warn("project_assignments lifecycle-columns ensure failed (non-fatal): {}",
                    e.getMessage(), e);
        }

        // Intern's self-provided GitHub username (used by the assignment
        // module so the TE can invite them as a collaborator out-of-band).
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR(100)");
            log.info("Ensured users.github_username column exists.");
        } catch (Exception e) {
            log.warn("users.github_username ensure failed (non-fatal): {}",
                    e.getMessage(), e);
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
