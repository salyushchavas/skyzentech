-- ============================================================================
-- One-shot cleanup: remove all demo-seeded INTERN accounts from production.
--
-- Generated as part of the "remove all seeded interns" task. Pairs with
-- the source-level disable of the four intern-creating seeders
-- (SeedDemoDataExecutor, TestDataSeeder, TestRoleUserSeeder,
-- TestAccountSeeder). Run this script ONCE against production after the
-- seeder-disable commit is deployed, so the rows don't get re-created on
-- the next boot.
--
-- HOW TO RUN (Railway Postgres):
--   1. Open the Railway project → Postgres service → "Data" tab → Query
--      (or `railway run psql` from the CLI).
--   2. Copy the entire block below INCLUDING the BEGIN/COMMIT.
--   3. Inspect the RAISE NOTICE output after the first SELECT to confirm
--      the expected user list (14 emails). If anything looks wrong,
--      ROLLBACK instead of COMMIT.
--   4. The DELETE block uses ON DELETE CASCADE where the schema has it;
--      if any FK constraint blocks a delete, the whole transaction rolls
--      back and you can investigate that one table.
--
-- This script does NOT touch:
--   - audit_log rows (kept as historical trail of who did what)
--   - any non-demo user (the email list is hard-coded)
--   - schema, indexes, sequences, seeded job postings, staff users
-- ============================================================================

BEGIN;

-- Lock the email list in one place so subsequent DELETEs all reference it.
-- Temp table is dropped automatically at COMMIT.
CREATE TEMP TABLE _demo_user_ids ON COMMIT DROP AS
SELECT id, email
FROM users
WHERE email IN (
    -- SeedDemoDataExecutor — 10 @example.com applicants
    'priya.sharma@example.com',
    'marcus.chen@example.com',
    'aisha.patel@example.com',
    'jamal.williams@example.com',
    'lin.zhou@example.com',
    'devon.king@example.com',
    'sarah.kim@example.com',
    'tom.garcia@example.com',
    'olivia.brown@example.com',
    'rachel.lee@example.com',

    -- TestDataSeeder — 3 .demo@skyzen.test interns
    'rohan.demo@skyzen.test',
    'anjali.demo@skyzen.test',
    'vikram.demo@skyzen.test',

    -- TestRoleUserSeeder / TestAccountSeeder
    'test-intern@skyzen.test'
);

-- Sanity check — preview what we're about to delete.
DO $$
DECLARE
    cnt int;
BEGIN
    SELECT COUNT(*) INTO cnt FROM _demo_user_ids;
    RAISE NOTICE 'About to delete % demo intern user(s) and their related rows.', cnt;
END $$;

-- Resolve dependent id sets up front so each DELETE is self-contained.
CREATE TEMP TABLE _demo_candidate_ids ON COMMIT DROP AS
SELECT id FROM candidates WHERE user_id IN (SELECT id FROM _demo_user_ids);

CREATE TEMP TABLE _demo_application_ids ON COMMIT DROP AS
SELECT id FROM applications WHERE candidate_id IN (SELECT id FROM _demo_candidate_ids);

CREATE TEMP TABLE _demo_resume_ids ON COMMIT DROP AS
SELECT id FROM resumes WHERE candidate_id IN (SELECT id FROM _demo_candidate_ids);

CREATE TEMP TABLE _demo_lifecycle_ids ON COMMIT DROP AS
SELECT id FROM intern_lifecycles WHERE user_id IN (SELECT id FROM _demo_user_ids);

CREATE TEMP TABLE _demo_offer_ids ON COMMIT DROP AS
SELECT id FROM offers WHERE application_id IN (SELECT id FROM _demo_application_ids);

CREATE TEMP TABLE _demo_engagement_ids ON COMMIT DROP AS
SELECT id FROM engagements
WHERE application_id IN (SELECT id FROM _demo_application_ids)
   OR candidate_id  IN (SELECT id FROM _demo_candidate_ids);

-- ── DELETE in dependency order (leaves first) ───────────────────────────────

-- Lifecycle-keyed children
DELETE FROM weekly_meetings   WHERE intern_lifecycle_id IN (SELECT id FROM _demo_lifecycle_ids);
DELETE FROM intern_evaluations WHERE intern_lifecycle_id IN (SELECT id FROM _demo_lifecycle_ids);
DELETE FROM project_assignments WHERE intern_lifecycle_id IN (SELECT id FROM _demo_lifecycle_ids);
DELETE FROM timesheets WHERE intern_lifecycle_id IN (SELECT id FROM _demo_lifecycle_ids);

-- Application-keyed children
DELETE FROM application_decision_logs WHERE application_id IN (SELECT id FROM _demo_application_ids);
DELETE FROM interviews WHERE application_id IN (SELECT id FROM _demo_application_ids);

-- Engagement / offer chain (engagements references offer + application + candidate)
DELETE FROM i983_plans WHERE candidate_id IN (SELECT id FROM _demo_candidate_ids);
DELETE FROM engagements WHERE id IN (SELECT id FROM _demo_engagement_ids);
DELETE FROM offers WHERE id IN (SELECT id FROM _demo_offer_ids);
DELETE FROM applications WHERE id IN (SELECT id FROM _demo_application_ids);
DELETE FROM resumes WHERE id IN (SELECT id FROM _demo_resume_ids);
DELETE FROM candidates WHERE id IN (SELECT id FROM _demo_candidate_ids);

-- User-keyed children (compliance / lifecycle / auth)
DELETE FROM intern_lifecycles WHERE id IN (SELECT id FROM _demo_lifecycle_ids);
DELETE FROM work_authorization_records WHERE user_id IN (SELECT id FROM _demo_user_ids);
DELETE FROM onboarding_items
WHERE onboarding_packet_id IN (
    SELECT id FROM onboarding_packets WHERE user_id IN (SELECT id FROM _demo_user_ids)
);
DELETE FROM onboarding_packets WHERE user_id IN (SELECT id FROM _demo_user_ids);
DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM _demo_user_ids);
DELETE FROM user_notifications WHERE user_id IN (SELECT id FROM _demo_user_ids);
DELETE FROM sent_notifications WHERE user_id IN (SELECT id FROM _demo_user_ids);
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM _demo_user_ids);

-- Finally the user rows themselves.
DELETE FROM users WHERE id IN (SELECT id FROM _demo_user_ids);

-- Confirmation
DO $$
DECLARE
    remaining int;
BEGIN
    SELECT COUNT(*) INTO remaining FROM users WHERE email IN (
        'priya.sharma@example.com','marcus.chen@example.com','aisha.patel@example.com',
        'jamal.williams@example.com','lin.zhou@example.com','devon.king@example.com',
        'sarah.kim@example.com','tom.garcia@example.com','olivia.brown@example.com',
        'rachel.lee@example.com','rohan.demo@skyzen.test','anjali.demo@skyzen.test',
        'vikram.demo@skyzen.test','test-intern@skyzen.test'
    );
    IF remaining = 0 THEN
        RAISE NOTICE 'OK — all demo intern accounts removed.';
    ELSE
        RAISE EXCEPTION 'Still % demo intern row(s) present — investigate before COMMIT.', remaining;
    END IF;
END $$;

COMMIT;

-- If any of the table names above don't exist in this database (older
-- schema variants), psql will error out and the whole transaction
-- rolls back — nothing partial. Comment out the offending DELETE,
-- re-run, and re-add it later when you know the table is gone for good.
