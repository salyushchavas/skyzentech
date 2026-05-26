# Role Model Refactor — PED §7

**Scope:** replace the 6-role enum + every authorization point + data migration. Nothing else.
**Status:** uncommitted; awaiting verification before push.

---

## STEP 1 — inventory

Already reported in the prior turn. Summary: every reference (1 enum, 136 `@PreAuthorize` strings, 6 service-level role-set fields, AdminUserService STAFF_ROLES, AuthService registration, AdminSeeder, RoleTestUsersSeeder, SeedDemoDataExecutor, VerificationBackfillRunner, frontend types + role-routing + sidebar + 52 page guards + 7 misc components, and the `user_roles` table) was covered by the mapping. No external integrations. **Nothing fell outside the mapping — proceeded with the refactor.**

JWT claims emit `r.name()` automatically, so no JWT code change needed — new enum names flow through.

## STEP 2 — backend

### New enum
[enums/UserRole.java](backend/src/main/java/com/skyzen/careers/enums/UserRole.java):
```java
APPLICANT, INTERN, HR_COMPLIANCE, OPERATIONS, TECHNICAL_SUPERVISOR, EXECUTIVE
```

### `@PreAuthorize` changes summary (per role)

| Old SpEL | New SpEL | Affected endpoints |
|---|---|---|
| `hasRole('CANDIDATE')` | `hasAnyRole('APPLICANT', 'INTERN')` | every candidate-self endpoint (`/api/v1/candidate/dashboard`, `/api/v1/i9/me`, `/api/v1/offers/me`, `/api/v1/applications/me`, `/api/v1/supervised/my/*`, `/api/v1/weekly-materials/me`, etc.) |
| `hasRole('ADMIN')` | `hasRole('OPERATIONS')` | every admin-only endpoint (`/api/v1/admin/users`, `/api/v1/admin/entities`, `/api/v1/i9/{id}/reopen`, etc.) |
| `hasRole('RECRUITER')` / `hasRole('ERM')` | `hasRole('OPERATIONS')` | collapses to one |
| `hasAnyRole('RECRUITER', 'ERM', 'ADMIN')` | `hasRole('OPERATIONS')` | dedup'd |
| `hasRole('TECHNICAL_EVALUATOR')` / `hasAnyRole(..., 'TECHNICAL_EVALUATOR', ...)` | `hasRole('TECHNICAL_SUPERVISOR')` | renames |
| `hasRole('HR_COMPLIANCE')` | unchanged | |
| `hasRole('ADMIN')` on leadership reads | `hasAnyRole('OPERATIONS', 'EXECUTIVE')` | `AdminInsightsController.overview` + `auditLog` + `auditLogActions` (3) |
| `hasAnyRole('HR_COMPLIANCE', 'ADMIN')` on compliance overview | `hasAnyRole('OPERATIONS', 'HR_COMPLIANCE', 'EXECUTIVE')` | `ComplianceOverviewController.getOverview` |

All other endpoints follow the mechanical translation. Done across all 25 controllers (136 `@PreAuthorize` lines) via a one-shot Python script that parsed and rewrote the SpEL expressions, then deduped within each `hasAnyRole(...)` tuple to avoid `OPERATIONS, OPERATIONS, …`.

### Role-set fields in services (renamed + deduped)

| File | Old set | New set |
|---|---|---|
| `AdminUserService.STAFF_ROLES` | `{RECRUITER, ERM, HR_COMPLIANCE, TECHNICAL_EVALUATOR, ADMIN}` | `{OPERATIONS, HR_COMPLIANCE, TECHNICAL_SUPERVISOR, EXECUTIVE}` |
| `OfferController.STAFF_ROLES` | `{ADMIN, ERM, HR_COMPLIANCE, RECRUITER}` | `{OPERATIONS, HR_COMPLIANCE}` |
| `OfferService.STAFF_ROLES` | `{ADMIN, ERM, HR_COMPLIANCE, RECRUITER}` | `{OPERATIONS, HR_COMPLIANCE}` |
| `I9FormService.READ_PRIVILEGED` | `{ADMIN, ERM, HR_COMPLIANCE, RECRUITER, TECHNICAL_EVALUATOR}` | `{OPERATIONS, HR_COMPLIANCE, TECHNICAL_SUPERVISOR}` |
| `I983Service.STAFF_ROLES` | `{ADMIN, ERM, HR_COMPLIANCE}` | `{OPERATIONS, HR_COMPLIANCE}` |
| `WeeklyMaterialService.ELEVATED_PUBLISHER_ROLES` | `{ADMIN, ERM}` | `{OPERATIONS}` |
| `ApplicationService.ensureCanRead` inline check | `ADMIN || RECRUITER || ERM` | `OPERATIONS` |
| `ResumeController.ensureCanDownload` inline | `ADMIN || RECRUITER || ERM` | `OPERATIONS` |
| `ScreeningService` privileged inline | `ADMIN || RECRUITER || ERM` | `OPERATIONS` |
| `InterviewService` two privileged inlines | `ADMIN || RECRUITER || ERM` + variant | `OPERATIONS` |
| `JobPostingService.canSeeDraft` | `ADMIN || ERM` | `OPERATIONS` |
| `OnboardingService` staff inline | `ADMIN || ERM` | `OPERATIONS` |
| `EvaluationSessionService` evaluator-type check | `TECHNICAL_EVALUATOR` | `TECHNICAL_SUPERVISOR` |

`contains(UserRole.CANDIDATE)` site-by-site (each context-aware):

| File | Site | Action |
|---|---|---|
| `AuthService.register` | `EnumSet.of(UserRole.CANDIDATE)` for new account | → `EnumSet.of(UserRole.APPLICANT)` |
| `AuthService.verifyEmail` | applicant-ID issuance gate | `contains(APPLICANT)` only (INTERN already has an ID by then) |
| `VerificationBackfillRunner` | applicant-ID backfill filter | `(APPLICANT || INTERN)` so legacy interns also get IDs |
| `SeedDemoDataExecutor` | demo-candidate role | → `APPLICANT` |
| `ApplicationService.ensureCanRead` | self-only access check | `(APPLICANT || INTERN)` |
| `OfferController.isCandidateOnly` | candidate-only view classifier | `(APPLICANT || INTERN)` |
| `OfferService.isCandidateOnly` | same | `(APPLICANT || INTERN)` |
| `I9FormService.requireReadAccess` candidate-own branch | candidate-own access | `(APPLICANT || INTERN)` |
| `InterviewService` interviewer-anti-check (×2) | "is the assigned interviewer themselves a candidate?" | `(APPLICANT || INTERN)` — refuses scheduling |
| `InterviewService.requireReadAccess` candidate-own | self interview view | `(APPLICANT || INTERN)` |
| `JobPostingService.canSeeDraft` non-candidate gate | "must not be a candidate" | `!(APPLICANT || INTERN)` |

### NEW — engagement role flip on hire

[EngagementService.applyTransition](backend/src/main/java/com/skyzen/careers/service/EngagementService.java) — the canonical single entry point for every engagement status change. When `target == EngagementStatus.ACTIVE`, the new helper `promoteApplicantToIntern(...)` runs:

- Resolves `engagement.candidate.user`.
- If the user's roles contain `APPLICANT`, replaces it with `INTERN`.
- Idempotent: a user already at `INTERN` is a no-op.
- Writes a `USER_ROLE_FLIP` audit row (`entityType=User`, `afterJson` carries from/to/engagementId) so the change is forensically visible.
- Wrapped in `try/catch` so a stray null cannot derail the ACTIVE transition itself.

This fires for both `transitionTo` (gated user action) and `transitionToSystem` (boot-time backfill) since both delegate to `applyTransition`.

### Endpoints left on a removed role
**None.** The mechanical SpEL rewrite covers every `@PreAuthorize` annotation; verified by grep — no `'CANDIDATE'` / `'RECRUITER'` / `'ERM'` / `'ADMIN'` / `'TECHNICAL_EVALUATOR'` string remains in any annotation across the 25 controllers.

---

## STEP 3 — data migration runner

[bootstrap/UserRoleMigrationRunner.java](backend/src/main/java/com/skyzen/careers/bootstrap/UserRoleMigrationRunner.java) — `@Component`, `@Order(Ordered.HIGHEST_PRECEDENCE + 1)`. Runs immediately after `SchemaFixupRunner` (HIGHEST_PRECEDENCE) and before `AdminSeeder` (@Order(1)) / `RoleTestUsersSeeder` (@Order(3)) / `SeedDemoDataRunner` (@Order(4)) / every backfill runner.

Native SQL via `JdbcTemplate` — bypasses Hibernate so it can read the old enum strings without crashing the converter.

```sql
-- CANDIDATE → INTERN when there's an ACTIVE engagement (must run FIRST)
UPDATE user_roles SET role = 'INTERN'
 WHERE role = 'CANDIDATE'
   AND user_id IN (SELECT c.user_id FROM candidates c
                   JOIN engagements e ON e.candidate_id = c.id
                   WHERE e.status = 'ACTIVE');

-- CANDIDATE → APPLICANT (everyone else)
UPDATE user_roles SET role = 'APPLICANT' WHERE role = 'CANDIDATE';

-- RECRUITER / ERM / ADMIN → OPERATIONS (one statement per old role so the
-- (user_id, role) PK doesn't collide for users who carried multiple).
-- Pattern: UPDATE … WHERE NOT EXISTS (user already has OPERATIONS),
-- then DELETE remaining old rows for users who DID already have OPERATIONS.
UPDATE user_roles SET role = 'OPERATIONS' WHERE role = 'RECRUITER' AND NOT EXISTS (…);
DELETE FROM user_roles WHERE role = 'RECRUITER';
UPDATE user_roles SET role = 'OPERATIONS' WHERE role = 'ERM' AND NOT EXISTS (…);
DELETE FROM user_roles WHERE role = 'ERM';
UPDATE user_roles SET role = 'OPERATIONS' WHERE role = 'ADMIN' AND NOT EXISTS (…);
DELETE FROM user_roles WHERE role = 'ADMIN';

-- TECHNICAL_EVALUATOR → TECHNICAL_SUPERVISOR
UPDATE user_roles SET role = 'TECHNICAL_SUPERVISOR' WHERE role = 'TECHNICAL_EVALUATOR';

-- Drop any stale Hibernate-generated CHECK constraint on user_roles.role
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
```

**Idempotent** — re-running after success affects 0 rows. Safe to leave in the runner family forever.

**How to trigger:** just deploy. The runner is wired as a `CommandLineRunner` and fires once at app startup (every boot, but only the first run touches any rows). No manual flag, no profile, no env var.

**Operations checklist after the first boot per environment:**
1. Watch logs for `Role migration:` info lines — confirm the per-bucket counts.
2. `SELECT role, count(*) FROM user_roles GROUP BY role;` should show ONLY the 6 new role names.
3. Existing JWTs carry old role names — **every user re-logs in**. Expected.

---

## STEP 4 — seeders

| File | Change |
|---|---|
| `AdminSeeder` | seeds OPERATIONS instead of ADMIN; check + log line wording updated; still driven by `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| `RoleTestUsersSeeder` | `recruiter@` → OPERATIONS, `erm@` → OPERATIONS, `hr@` → HR_COMPLIANCE, `evaluator@` → TECHNICAL_SUPERVISOR, NEW `executive@skyzen.test` / `executive12345` → EXECUTIVE |
| `SeedDemoDataExecutor` | demo candidates now seed `APPLICANT` |
| `AuthService.register` | new candidate registration seeds `APPLICANT` |
| `AuthService.verifyEmail` | applicant-ID issuance gate now keys off `APPLICANT` |
| `VerificationBackfillRunner` | applicant-ID backfill now accepts `APPLICANT || INTERN` (legacy interns who pre-date the applicantId rollout also get one stamped) |

`AdminSeeder` still skips when ANY user with `OPERATIONS` already exists — confirms an Operations admin survives after each boot.

---

## STEP 5 — frontend

| File | Change |
|---|---|
| `types/index.ts` | `UserRole` union → six new values |
| `lib/role-routing.ts` | `ROLE_DASHBOARDS` — APPLICANT + INTERN → `/careers/candidate`; OPERATIONS → `/careers/recruiter`; HR_COMPLIANCE → `/careers/hr`; TECHNICAL_SUPERVISOR → `/careers/evaluator`; EXECUTIVE → `/careers/admin` |
| `components/dashboard/DashboardSidebar.tsx` | `ROLE_LINKS` rebuilt — APPLICANT + INTERN share one `CANDIDATE_LINKS` array; OPERATIONS is the union of the old RECRUITER + ERM + ADMIN sidebars; EXECUTIVE is read-only (Overview + Audit Log + Compliance). Default-role fallback flipped from `'CANDIDATE'` to `'APPLICANT'`. Training-Plan tile filter rewritten to `isCandidate = role === 'APPLICANT' || role === 'INTERN'`. |
| 45 page files | every `requiredRoles={['CANDIDATE']}` → `{['APPLICANT', 'INTERN']}`; every `{['RECRUITER', 'ERM', 'ADMIN']}` → `{['OPERATIONS']}`; every `{[..., 'TECHNICAL_EVALUATOR', ...]}` → `{[..., 'TECHNICAL_SUPERVISOR', ...]}`. Bulk rewritten via Python script + dedup. |
| `frontend/app/careers/(dashboard)/erm/interviews/page.tsx` + `[id]/page.tsx` | inline role arrays (`ALLOWED_ROLES`, `WRITE_ROLES`, `ADMIN_ERM`) substituted + deduped |
| `hr/i9-everify/everify/[id]/page.tsx` + `i9/[id]/page.tsx` | role-membership `.includes` checks rewritten — `'ADMIN'` → `'OPERATIONS'`; HR_COMPLIANCE unchanged |
| `components/careers/AdaptiveCareersLayout.tsx` + `OpeningsSplit.tsx` | `isCandidate = roles.includes('CANDIDATE')` → `(includes('APPLICANT') \|\| includes('INTERN'))` |
| `components/recruiter/PipelineTable.tsx` | `BULK_ROLES` constant collapsed to `['OPERATIONS']` |
| `app/careers/admin/users/page.tsx` | STAFF_ROLES picker → `['OPERATIONS', 'HR_COMPLIANCE', 'TECHNICAL_SUPERVISOR', 'EXECUTIVE']`; ROLE_LABEL + ROLE_COLOR maps rewritten with new keys and display labels per PED ("HR / Compliance", "Technical Supervisor", "Executive"); `primaryRole()` helper now checks OPERATIONS first; default role-picker state → `'OPERATIONS'` (two `useState` initializers) |

Verified by grep: zero remaining `'CANDIDATE'` / `'RECRUITER'` / `'ERM'` / `'ADMIN'` / `'TECHNICAL_EVALUATOR'` string literals across all `frontend/**/*.{ts,tsx}` (excluding node_modules).

---

## Config + ops prerequisites

| Item | What | Status |
|---|---|---|
| **`user_roles` migration runs** | `UserRoleMigrationRunner` fires on first boot per environment. Without it, no user can log in (Hibernate fails to deserialize old enum strings). | Wired into bootstrap @Order(HIGHEST_PRECEDENCE + 1). No-op on subsequent boots. |
| **Existing JWTs invalidated** | Old `roles` claim values fail `hasRole(...)` against the new enum names. | **All users must re-login after deploy.** Expected, documented. |
| **No new env vars** | AdminSeeder still uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` — but the seeded user now carries `OPERATIONS` instead of `ADMIN`. | ✅ |
| **Operations admin survives boot** | AdminSeeder runs every boot, skips when any user with `OPERATIONS` already exists. | ✅ |

---

## Manual test steps

> Local backend via `backend/run-dev.ps1`; frontend `cd frontend && npm run dev`. `SPRING_PROFILES_ACTIVE` unset so seeders run.

### T1 — Migration runs cleanly
1. Wipe local DB (or use the dev DB with old-role data). Start the backend.
2. Watch logs:
   ```
   Role migration: CANDIDATE→INTERN (active engagement): N rows
   Role migration: CANDIDATE→APPLICANT: M rows
   Role migration: RECRUITER/ERM/ADMIN→OPERATIONS: X rows
   Role migration: TECHNICAL_EVALUATOR→TECHNICAL_SUPERVISOR: Y rows
   Role migration complete: TOTAL rows rewritten.
   ```
3. `SELECT role, count(*) FROM user_roles GROUP BY role;` — only the 6 new values appear.
4. Restart — same lines appear with `0 rows` (idempotency).

### T2 — Log in as each of the six roles
Demo accounts (post-seed):

| Role | Email | Password | Lands on |
|---|---|---|---|
| APPLICANT | any freshly-registered candidate | (user-set) | `/careers/candidate` (applicant face) |
| INTERN | a candidate whose engagement is ACTIVE | (user-set) | `/careers/candidate` (intern face, same route — the dashboard adapts) |
| HR_COMPLIANCE | `hr@skyzen.test` | `hr12345` | `/careers/hr` |
| OPERATIONS | `recruiter@skyzen.test` OR `erm@skyzen.test` OR `admin@skyzen.test` (the bootstrap admin) | their seeded password | `/careers/recruiter` |
| TECHNICAL_SUPERVISOR | `evaluator@skyzen.test` | `evaluator12345` | `/careers/evaluator` |
| EXECUTIVE | `executive@skyzen.test` | `executive12345` | `/careers/admin` |

For each:
- Auth completes; the dashboard loads.
- Sidebar shows the right nav (OPERATIONS sees the combined pipeline/candidates/interviews/offers/postings/users/entities/audit list; EXECUTIVE sees only Overview + Audit Log + Compliance).
- `curl -i -H "Authorization: Bearer <JWT>" https://<host>/api/v1/candidate/dashboard` against an APPLICANT JWT returns 200; against an OPERATIONS JWT returns 403 (not a candidate-side route).

### T3 — APPLICANT becomes INTERN after hire
1. Log in as `priya.sharma@example.com` (demo APPLICANT). Note her role in DevTools auth payload: `['APPLICANT']`.
2. As OPERATIONS, walk her application through to ACCEPTED, then create + activate the engagement (`POST /api/v1/engagements/{id}/mark-ready`, then `POST /api/v1/engagements/{id}/start` — the latter calls `applyTransition(..., ACTIVE)`).
3. In Priya's session, log out and back in. JWT now carries `['INTERN']`.
4. SQL: `SELECT role FROM user_roles WHERE user_id = (SELECT id FROM users WHERE email = 'priya.sharma@example.com');` → `INTERN`.
5. Audit log: `SELECT * FROM audit_logs WHERE action = 'USER_ROLE_FLIP' ORDER BY timestamp DESC LIMIT 1;` → one row, `afterJson` shows `{"from":"APPLICANT","to":"INTERN","engagementId":"..."}`.

### T4 — Candidate dashboard works for both APPLICANT and INTERN
1. As an APPLICANT, navigate to `/careers/candidate`. The journey-bar shows the applicant stages (Applied → Hired), the next-step hero reflects pre-hire state.
2. As an INTERN (post-T3 promotion), same URL `/careers/candidate`. The page adapts: engagement summary panel appears; sub-step list under the current stage transitions to the post-hire flow per the existing dashboard logic.
3. Both routes use `requiredRoles={['APPLICANT', 'INTERN']}` — no role mismatch redirect.

### T5 — OPERATIONS holds all former admin powers
As `admin@skyzen.test` (the bootstrap OPERATIONS user):
- `GET /api/v1/admin/users` → 200 (was ADMIN-only; now OPERATIONS).
- `GET /api/v1/admin/entities` → 200.
- `POST /api/v1/admin/users` (create new EXECUTIVE) → 201.
- `GET /api/v1/admin/audit-log` → 200 (also accessible to EXECUTIVE for read-only).

### T6 — EXECUTIVE is read-only
As `executive@skyzen.test`:
- `GET /api/v1/admin/overview` → 200.
- `GET /api/v1/admin/audit-log` → 200.
- `GET /api/v1/compliance/overview` → 200.
- `POST /api/v1/admin/users` → 403 (EXECUTIVE is not in the create-user role set).
- `POST /api/v1/applications/{id}/shortlist` → 403.
- `POST /api/v1/offers` → 403.

### T7 — No endpoint stranded on a removed role
```
grep -rn "'CANDIDATE'\|'RECRUITER'\|'ERM'\|'TECHNICAL_EVALUATOR'\|hasRole('ADMIN'" backend/src/main/java --include="*.java"
```
Should return ONLY hits inside `UserRoleMigrationRunner.java` (SQL strings + javadoc explaining what it migrates).

### T8 — Logout-then-login forced by old JWTs
1. Before the deploy, log in as a demo user; copy the JWT.
2. After the deploy, hit any protected endpoint with that old JWT:
   ```
   curl -i -H "Authorization: Bearer <old JWT>" https://<host>/api/v1/users/me
   ```
   Expected: 403 (the JWT's `roles` claim has e.g. `["CANDIDATE"]` — no `hasRole` SpEL matches that anymore). The browser interceptor redirects to `/careers/login`. After re-login, the new JWT carries the new role names.

---

## What I deliberately did NOT change
- The two ERM-named routes `/careers/erm/interviews` + `/careers/erm/training-plans` — left at the same URLs since renaming them would touch every cross-reference in the sidebar / dashboard / activity links. They're now reachable by OPERATIONS (per the new role gate), and OPERATIONS sees them in their sidebar. URL-path rename is a future cosmetic pass.
- Demo emails `recruiter@` / `erm@` / `evaluator@` — kept the historical aliases for muscle-memory; only the seeded role changed. Added `executive@skyzen.test` (new).
- No new env vars. No new DB columns. No schema changes beyond the data rewrite.
- No engagement-deactivation role flip (INTERN → APPLICANT). Once promoted, INTERN sticks until an OPERATIONS admin explicitly changes it. Audit / forensic posture: someone who was ever an intern keeps the marker.

## Files touched (count)
- Backend new: 1 (`UserRoleMigrationRunner`)
- Backend modified: 41 (1 enum + 25 controllers + 14 services + 1 dto/admin) + 4 bootstrap (Admin, RoleTestUsers, SeedDemoData, Verification)
- Frontend modified: 1 type alias + 1 role-routing + 1 sidebar + 45 page files + 7 misc components = 55
- Total: ~100 files

---

# SUPER_ADMIN split — owner role separated from OPERATIONS

**Scope:** add SUPER_ADMIN as a 7th role above the PED §7 six; move god-mode (user mgmt, role mgmt, audit-log read, I-9 admin overrides) OFF OPERATIONS, ONTO SUPER_ADMIN. OPERATIONS stays as the recruiter/ERM operational role (postings, interviews, onboarding, applications pipeline).
**Status:** uncommitted; awaiting verification before push.

## Why the split
After PED §7, the old ADMIN role was folded into OPERATIONS. That made the bootstrap admin indistinguishable from every recruiter/ERM (also OPERATIONS). The SUPER_ADMIN split restores the owner-vs-operational distinction without re-creating the full ADMIN-named ladder.

SUPER_ADMIN does **not** inherit OPERATIONS scope — a single account that needs both must be assigned both roles. This keeps the privilege surface predictable: god-mode endpoints check exactly one role.

## Inventory — endpoints that moved (god-mode → SUPER_ADMIN)

| Controller / endpoint | Old SpEL | New SpEL | Reason |
|---|---|---|---|
| `AdminUserController` — list / create / updateRole / updateStatus | `hasRole('OPERATIONS')` | `hasRole('SUPER_ADMIN')` | user management |
| `AdminEntityController` — list / create / update | `hasRole('OPERATIONS')` | `hasRole('SUPER_ADMIN')` | entity management |
| `AdminInsightsController.overview` | `hasAnyRole('OPERATIONS','EXECUTIVE')` | `hasAnyRole('SUPER_ADMIN','EXECUTIVE')` | platform overview — EXECUTIVE read-only retained per PED §7 |
| `AdminInsightsController.auditLog` + `auditLogActions` | `hasAnyRole('OPERATIONS','EXECUTIVE')` | `hasAnyRole('SUPER_ADMIN','EXECUTIVE')` | audit-log read — EXECUTIVE retained |
| `I9Controller.saveSection1` | `hasAnyRole('APPLICANT','INTERN','OPERATIONS')` | `hasAnyRole('APPLICANT','INTERN','SUPER_ADMIN')` | A1-gate bypass corrective path — was `ADMIN` originally |
| `I9Controller.reopen` | `hasRole('OPERATIONS')` | `hasRole('SUPER_ADMIN')` | reopen breaks lifecycle immutability — owner-only, not operational. Was `ADMIN` originally |

### Endpoints I considered but kept on OPERATIONS
- `JobPostingController.create / update / delete / archive` — postings are operational, not god-mode. **Stays OPERATIONS.**
- `InterviewController.*` — interview scheduling is recruiter day-to-day. **Stays OPERATIONS.**
- `OnboardingController.*`, `OfferController.*`, `EngagementController.*`, `ApplicationController.*` — applications pipeline. **All stay OPERATIONS.**
- `AdminInsightsController` audit-log endpoints — EXECUTIVE retained alongside SUPER_ADMIN per PED §7 (Executive Dashboard widget).
- `ComplianceOverviewController.getOverview` — operational compliance read; EXECUTIVE + HR_COMPLIANCE + OPERATIONS all read it. **Unchanged.**

No audit-log export/download endpoint exists yet — only the paged read covered by `AdminInsightsController`. If one is added, gate it `hasRole('SUPER_ADMIN')` only (EXECUTIVE may read but not export — per the brief).

## Services updated

| File | Change |
|---|---|
| `AdminUserService.STAFF_ROLES` | added `SUPER_ADMIN`; STAFF_ROLE_MSG updated. SUPER_ADMIN can now assign itself to other staff accounts. |
| `AdminUserService.updateRole` self-lockout guard | flipped from "can't remove own OPERATIONS" → "can't remove own SUPER_ADMIN". The last SUPER_ADMIN can't accidentally demote themselves out of god-mode. |
| `I9FormService.isAdmin()` | now checks `SUPER_ADMIN` (was `OPERATIONS`). This is the A1-gate corrective-write bypass; godmode lives on SUPER_ADMIN only. |
| `I9FormService.requireSection1WriteAccess` | bypass branch now SUPER_ADMIN-only (was OPERATIONS). Aligns with the new controller gate. |

## Bootstrap — promotion + seeder

**New runner** — [`SuperAdminPromotionRunner`](backend/src/main/java/com/skyzen/careers/bootstrap/SuperAdminPromotionRunner.java)
- `@Order(Ordered.HIGHEST_PRECEDENCE + 2)` — between `UserRoleMigrationRunner` (PRECEDENCE+1) and `AdminSeeder` (@Order 1).
- Resolves the user at `admin.email`. If they have OPERATIONS, swaps that row for SUPER_ADMIN (UPDATE, not DELETE+INSERT, so any audit trigger sees one change). If no OPERATIONS row, INSERTs SUPER_ADMIN alongside whatever exists. Idempotent — no-op if already SUPER_ADMIN or if no user at that email.
- Writes a `USER_ROLE_FLIP` audit row (action, entityType=User, entityId+userId=promoted user, afterJson with from/to/reason). Audit insert is wrapped in try/catch so a schema mismatch can't block the promotion.
- **Promotion is by IDENTITY (email match), not by role.** OPERATIONS users in general are NOT promoted — exactly one account, the one matching `ADMIN_EMAIL`, becomes SUPER_ADMIN.
- All in native SQL via `JdbcTemplate` — same reason as `UserRoleMigrationRunner`, bypassing the JPA enum converter so a transitional value never has to round-trip through the enum.

**Modified seeder** — [`AdminSeeder`](backend/src/main/java/com/skyzen/careers/bootstrap/AdminSeeder.java)
- Idempotency now checks "is there a user at `admin.email`?" instead of "is there any user with OPERATIONS?" — necessary because OPERATIONS is no longer the unique god-mode role.
- Creates the bootstrap user with `EnumSet.of(SUPER_ADMIN)` (was OPERATIONS). `fullName` changed to "Bootstrap Super Admin".
- Runs AFTER `SuperAdminPromotionRunner`, so an existing OPERATIONS account at `admin.email` is already promoted by the time the seeder looks.

## Frontend

- `frontend/types/index.ts` — UserRole union now includes `SUPER_ADMIN`; comment updated to explain the split.
- `frontend/lib/role-routing.ts` — `ROLE_DASHBOARDS.SUPER_ADMIN = '/careers/admin'`. New `ROLE_LANDING_PRIORITY` array picks the highest-privilege role when a user carries multiple (SUPER_ADMIN > EXECUTIVE > OPERATIONS > ...).
- `frontend/components/dashboard/DashboardSidebar.tsx`:
  - **NEW** `SUPER_ADMIN` sidebar: Overview / Users / Entities / Audit Log / Compliance.
  - **OPERATIONS sidebar PRUNED**: removed the Users / Entities / Audit Log / Overview tiles (they were god-mode remnants from the §7 fold). OPERATIONS now sees: Pipeline / Candidates / Interviews / Offer Letters / I-983 Plans / Postings / Supervised. Recruiter/ERM day-to-day, no admin screens.
- ProtectedRoute updates:
  - `/careers/admin` (overview) — `['OPERATIONS']` → `['SUPER_ADMIN', 'EXECUTIVE']`
  - `/careers/admin/users` — `['OPERATIONS']` → `['SUPER_ADMIN']`
  - `/careers/admin/entities` — `['OPERATIONS']` → `['SUPER_ADMIN']`
  - `/careers/admin/audit-log` — `['OPERATIONS']` → `['SUPER_ADMIN', 'EXECUTIVE']`
  - `/careers/admin/postings` — **unchanged** (`['OPERATIONS']`)
- `frontend/app/careers/admin/users/page.tsx`:
  - `STAFF_ROLES` picker now starts with `SUPER_ADMIN` (so SUPER_ADMIN can grant SUPER_ADMIN to a second account, e.g., when handing off).
  - `ROLE_LABEL.SUPER_ADMIN = 'Super admin'`; `ROLE_COLOR.SUPER_ADMIN = 'bg-indigo-100 text-indigo-800'`.
  - `primaryRole()` ordering: SUPER_ADMIN > OPERATIONS > other staff > first.

## Data — exactly one account is promoted

The promotion is keyed on `admin.email` (the `ADMIN_EMAIL` env var). I'll confirm the actual value at deploy-time, but on the local dev DB the bootstrap admin email is `admin@skyzen.test` — only that account becomes SUPER_ADMIN. **No bulk promotion of OPERATIONS** — recruiters/ERMs stay on OPERATIONS.

## Re-login is required

A user promoted from OPERATIONS to SUPER_ADMIN still carries an OPERATIONS-only `roles` claim in their existing JWT. SUPER_ADMIN-gated endpoints return 403 until next login (same mechanic as the PED §7 deploy). Document and tell the affected user: "log out, log back in." Same applies to anyone whose role set changes through the admin UI — JWTs aren't rotated server-side.

## Manual test plan

### T9 — Bootstrap promotion at first boot
1. Fresh DB (or one where the `admin.email` user already exists on OPERATIONS).
2. Start backend. Watch logs.
3. Expect:
   - `UserRoleMigrationRunner: ...` lines (no-op on a post-§7 DB; harmless).
   - `SuperAdminPromotionRunner: promoted <email> (OPERATIONS → SUPER_ADMIN), 1 row(s) rewritten. User must RE-LOGIN ...` — OR — `SuperAdminPromotionRunner: user <email> already SUPER_ADMIN, no-op`.
   - `Admin seeder` returns silently (user exists).
4. Re-run: should log idempotent no-op.

### T10 — Login as SUPER_ADMIN
1. Log out the currently-logged-in admin (or open a private window).
2. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
3. JWT decoded should show `roles: ["SUPER_ADMIN"]`.
4. Land on `/careers/admin`. Sidebar shows Overview / Users / Entities / Audit Log / Compliance (no Pipeline, no Candidates).

### T11 — OPERATIONS user blocked from admin screens
1. Log in as `recruiter@skyzen.test` (or any OPERATIONS-only seeded user).
2. Sidebar should NOT show Users / Entities / Audit Log / Overview.
3. Direct-navigate to `/careers/admin/users` — ProtectedRoute redirects (or shows 403 toast).
4. Direct-navigate to `/careers/admin/postings` — **allowed** (operational, kept on OPERATIONS).

### T12 — EXECUTIVE retains read-only admin
1. Log in as the EXECUTIVE seeded user.
2. `/careers/admin` (Overview) — allowed.
3. `/careers/admin/audit-log` — allowed.
4. `/careers/admin/users` — denied (SUPER_ADMIN only).
5. `/careers/admin/entities` — denied (SUPER_ADMIN only).

### T13 — Self-lockout guard flipped
1. As SUPER_ADMIN, open `/careers/admin/users`, find your own row, click Change role, pick OPERATIONS.
2. Expect 409: "You cannot remove your own SUPER_ADMIN role."
3. Pick any role other than your current one for any **other** user, confirm 200.

### T14 — I-9 corrective bypass moved
1. As SUPER_ADMIN, `POST /api/v1/i9/{id}/section1` with a body that would otherwise be A1-gate-blocked (e.g., candidate has no accepted offer yet). Expect 200 — bypass path active.
2. As OPERATIONS (not SUPER_ADMIN), same call. Expect 403 (controller gate; OPERATIONS is no longer in `hasAnyRole` for `saveSection1`).

### T15 — Old JWT still in browser → forced re-login
1. Before the deploy, log in as the bootstrap admin; copy the JWT.
2. After this change is deployed, paste that JWT into a new tab and hit `/api/v1/admin/users` — expect 403 (claim says OPERATIONS, gate now requires SUPER_ADMIN). Frontend interceptor redirects to `/careers/login`.
3. Re-login → new JWT carries SUPER_ADMIN → admin screens render.

## What I deliberately did NOT change
- **`/careers/admin/postings`** — postings stay on OPERATIONS (recruiter day-to-day, not god-mode).
- **No new env vars.** `ADMIN_EMAIL` / `ADMIN_PASSWORD` are reused as-is. The promotion uses these existing values.
- **No bulk promotion.** Every other OPERATIONS user stays exactly where they are. The CONSCIOUSLY surgical choice: identity-based promotion, not role-based.
- **No new dashboards.** SUPER_ADMIN reuses the existing `/careers/admin/*` screens; only ProtectedRoute gates changed.
- **No JWT rotation on role change.** SUPER_ADMIN must log out / back in (already standard practice for role changes in this codebase).
- **No engagement-side role flip.** SUPER_ADMIN does not change the APPLICANT → INTERN flip behavior.

## Files touched (count)
- Backend new: 1 (`SuperAdminPromotionRunner`)
- Backend modified: 7 (UserRole.java + AdminUserController + AdminEntityController + AdminInsightsController + I9Controller + AdminUserService + I9FormService + AdminSeeder = 8 — `SuperAdminPromotionRunner` is new not modified)
- Frontend modified: 1 type alias + 1 role-routing + 1 sidebar + 4 admin page guards (overview, users, entities, audit-log) + users-page maps = 8
- Total: ~17 files
