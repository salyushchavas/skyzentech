# Candidate Dashboard — Applicant Face (Phase 1)

**Scope:** the applicant face of the candidate/intern dashboard, per `CANDIDATE_DASHBOARD_SPEC.md`. Intern face out of scope (depends on features still in progress).
**Status:** uncommitted; awaiting verification.

---

## Step 0 — what already existed (reused, not rebuilt)

| Existing surface | What it does | Where |
|---|---|---|
| `GET /api/v1/candidate/dashboard` endpoint | Caller-scoped aggregate; `@PreAuthorize("hasRole('CANDIDATE')")`; `@AuthenticationPrincipal` | [CandidateDashboardController.java:25-29](backend/src/main/java/com/skyzen/careers/controller/CandidateDashboardController.java#L25-L29) |
| `CandidateDashboardService.build(User)` | Already builds: profile completeness (7-factor), applications, offers, upcoming interviews, onboarding tasks, **NextStep priority ladder**, upcoming items, recent activity from `audit_logs`, **engagement summary**, **compliance items panel** (I-9 §1, §2, E-Verify, I-983, track-aware) | [CandidateDashboardService.java](backend/src/main/java/com/skyzen/careers/service/CandidateDashboardService.java) |
| Application stage mapping | `ApplicationLifecycle.stageIndexOf` 5-stage stepper + `isExited` | [ApplicationLifecycle.java](backend/src/main/java/com/skyzen/careers/application/ApplicationLifecycle.java) |
| Per-track compliance gate | `ComplianceRoutingService.missingRequirements(Engagement)` already computes the I-9 / I-983 (STEM) / E-Verify (STEM + opt-in) / CPT-I20 list — same shape we need for the sub-step list | [ComplianceRoutingService.java:178-250](backend/src/main/java/com/skyzen/careers/service/ComplianceRoutingService.java#L178-L250) |
| Resume default lookup | `ResumeRepository.findByCandidateId` + `Candidate.defaultResumeId` | [Resume.java](backend/src/main/java/com/skyzen/careers/entity/Resume.java), [ResumeRepository.java](backend/src/main/java/com/skyzen/careers/repository/ResumeRepository.java) |
| Frontend page | Old candidate dashboard with applications list + StatusStepper mini + ComplianceStatusCard + Upcoming + Activity | replaced this turn — [candidate/page.tsx](frontend/app/careers/(dashboard)/candidate/page.tsx) |
| Auth context + ProtectedRoute | Role gate + user/applicantId state | [auth-context.tsx](frontend/lib/auth-context.tsx), [ProtectedRoute](frontend/components/ProtectedRoute.tsx) |
| Lucide icons, Tailwind theme, `formatRelative` | UI primitives | already in repo |

**Net: ~80% of the data plumbing already existed.** This commit *extends* the existing DTO + service; it doesn't rebuild them.

---

## Files (6 total)

### Backend — modified
- [dto/candidate/CandidateDashboardResponse.java](backend/src/main/java/com/skyzen/careers/dto/candidate/CandidateDashboardResponse.java) — added `Journey` + `JourneyStage` + `SubStep` + `ResumeInfo` nested types; extended `NextStep` with `isWaiting` / `waitingFor` / `expectedBy`.
- [service/CandidateDashboardService.java](backend/src/main/java/com/skyzen/careers/service/CandidateDashboardService.java) — new methods `buildJourney`, `resolveCurrentStageKey`, `buildSubStepsFor`, `buildOnboardingSubSteps`, `buildResumeInfo`; extended `pickNextStep` with waiting-state markers + missing branches (SCREENING_COMPLETED, INTERVIEWED, READY_TO_START, COMPLETED, BLOCKED_NO_AUTHORIZATION, PENDING_COMPLIANCE awaiting-HR, all-apps-exited).

### Backend — unchanged but reused
- `CandidateDashboardController.java` — endpoint URL + auth annotations untouched.
- `ComplianceRoutingService.missingRequirements` — used as the source-of-truth shape for the Onboarding sub-step list.

### Frontend — new
- [components/dashboard/JourneyBar.tsx](frontend/components/dashboard/JourneyBar.tsx) — reusable journey bar component. Takes any `CandidateJourney`; renders the macro-step strip + the current stage's sub-checklist. **Reusable for the intern face later** (different stages payload, same component).

### Frontend — modified
- [types/index.ts](frontend/types/index.ts) — appended `StageState`, `SubStepState`, `SubStepOwner`, `CandidateSubStep`, `CandidateJourneyStage`, `CandidateJourney`, `CandidateResumeInfo`.
- [app/careers/(dashboard)/candidate/page.tsx](frontend/app/careers/(dashboard)/candidate/page.tsx) — full rewrite per SPEC §2–§7: header (greeting + applicant ID + stage pill + bell), JourneyBar, NextStep hero (action / urgent / waiting variants), 3-up status cards (application / profile / resume), 2-col Upcoming + Recent activity.

---

## Summary-endpoint JSON shape (additions only — existing fields retained)

`GET /api/v1/candidate/dashboard` response now includes:

```jsonc
{
  // … existing fields: candidateName, profileComplete, applications,
  //                    upcoming, recentActivity, engagement, compliance
  "nextStep": {
    "type": "AWAITING_DECISION",
    "title": "Interview complete — Backend Developer Intern",
    "subtitle": "We're reviewing your interview — expect to hear back soon.",
    "ctaLabel": "View application",
    "ctaHref": "/careers/candidate/applications",
    "isWaiting": true,                              // NEW
    "waitingFor": "Hiring team reviewing your scorecard",  // NEW
    "expectedBy": null                              // NEW (Instant or null)
  },
  "journey": {                                       // NEW
    "currentStageKey": "ONBOARDING",
    "isExited": false,
    "stages": [
      { "key": "APPLIED",     "label": "Applied",     "state": "done",     "subSteps": [] },
      { "key": "SCREENING",   "label": "Screening",   "state": "done",     "subSteps": [] },
      { "key": "INTERVIEW",   "label": "Interview",   "state": "done",     "subSteps": [] },
      { "key": "OFFER",       "label": "Offer",       "state": "done",     "subSteps": [] },
      { "key": "ONBOARDING",  "label": "Onboarding",  "state": "current",
        "subSteps": [
          { "key": "I983_PLAN",       "label": "Form I-983 Training Plan",
            "state": "current", "owner": "employer",
            "href": "/careers/candidate/training-plans",
            "subtitle": "ERM will draft your training plan" },
          { "key": "I9_SECTION_1",    "label": "Form I-9 — Section 1",
            "state": "current", "owner": "you",
            "href": "/careers/candidate/i9",
            "subtitle": "Sign by your first day" },
          { "key": "I9_SECTION_2",    "label": "Form I-9 — Section 2 (HR)",
            "state": "upcoming", "owner": "employer",
            "href": null,
            "subtitle": "Within 3 business days of your start" },
          { "key": "EVERIFY",         "label": "E-Verify",
            "state": "upcoming", "owner": "employer",
            "href": null,
            "subtitle": "HR opens the case after Form I-9 is complete" },
          { "key": "ONBOARDING_TASKS","label": "Onboarding tasks (3 of 9)",
            "state": "current", "owner": "you",
            "href": "/careers/candidate/onboarding",
            "subtitle": "Policy acks, GitHub access, supervisor intro" }
        ] },
      { "key": "HIRED",       "label": "Hired",       "state": "upcoming", "subSteps": [] }
    ]
  },
  "resume": {                                        // NEW (nullable)
    "id": "…uuid…",
    "fileName": "Priya_Sharma_Resume.pdf",
    "uploadedAt": "2026-05-14T20:31:07.882Z"
  }
}
```

Field types: see [CandidateDashboardResponse.java](backend/src/main/java/com/skyzen/careers/dto/candidate/CandidateDashboardResponse.java).

---

## The JourneyBar component (reusable)

[components/dashboard/JourneyBar.tsx](frontend/components/dashboard/JourneyBar.tsx). Props:

```ts
function JourneyBar({ journey }: { journey: CandidateJourney }): JSX.Element | null;
```

Renders two altitudes:

1. **Stage strip** — one dot per `journey.stages[]` entry. State → visual:
   - `done` → emerald check
   - `current` → accent dot, 2-ring emphasis, "Current" caption
   - `upcoming` → muted gray lock
   - `blocked` → red triangle
2. **Sub-checklist** — shown ONLY for the current stage. Each `subStep` renders with:
   - state icon (check / dot / clock / lock / triangle)
   - label + owner pill (You / Recruiter / Employer / Supervisor / DSO / System)
   - optional subtitle
   - optional `Waiting` chip when `state === "waiting"`
   - whole row is a link when `step.href` is set, plain div otherwise

**Reusable for the intern face later:** pass a different `journey` payload (e.g. Setup → Active week → Evaluation → Completed) — the component itself doesn't know it's "applicant" vs "intern". No changes needed when we wire the intern shell.

---

## Next-step / waiting resolver

`CandidateDashboardService.pickNextStep` priority ladder (top wins). The user-owned vs waiting marker is encoded via `isWaiting`:

| Priority | Trigger | Type | isWaiting | waitingFor |
|---|---|---|---|---|
| 1 | Live SENT offer | `OFFER` | false | — |
| 2 | `application.status = SCREENING_SENT` | `SCREENING` | false | — |
| 3 | Upcoming interview row exists | `INTERVIEW` | false | — |
| 4 | Onboarding tasks incomplete | `ONBOARDING` | false | — |
| 5 | `engagement.status = ACTIVE` | `WORK` | false | — |
| 6 | `engagement.status = BLOCKED_NO_AUTHORIZATION` | `EXITED` | true | HR/legal review of work auth |
| 7 | `engagement.status = COMPLETED` | `WELCOME` | false | — *(celebration state)* |
| 8 | `engagement.status = READY_TO_START` | `AWAITING_READY` | true | start date / supervisor activation |
| 9 | `engagement.status = PENDING_COMPLIANCE` (post-onboarding) | `AWAITING_HR_I9` | true | HR completing post-offer compliance |
| 10 | `application.status = SELECTED_CONDITIONAL` | `SELECTED_CONDITIONAL` | true | HR drafting your formal offer |
| 11 | `application.status = INTERVIEWED` | `AWAITING_DECISION` | true | Hiring team reviewing your scorecard |
| 12 | `application.status = SHORTLISTED` | `SHORTLISTED` | true | Recruiter scheduling your interview |
| 13 | `application.status = SCREENING_COMPLETED` | `AWAITING_SCREENING` | true | Recruiter reviewing your screening |
| 14 | `application.status = APPLIED` | `APPLIED` | true | Recruiter reviewing your application |
| 15 | No applications + profile <100% | `PROFILE` | false | — |
| 16 | No applications + profile 100% | `BROWSE` | false | — |
| 17 | All apps exited (final fallback) | `EXITED` | false | — *(re-apply prompt)* |

**Never null** (SPEC §5 acceptance criterion): every code path returns a non-null `NextStep`. The frontend hero renders three variants:
- **urgent** (`type=OFFER`) — amber border, amber CTA
- **waiting** (`isWaiting=true`) — sky-blue border, ghost CTA, "Waiting" chip + `waitingFor` line under the title
- **action** (everything else) — accent border, accent CTA

---

## Frontend routes touched
- **`/careers/candidate`** — full rewrite. Replaces the old candidate landing page. Same route, same `ProtectedRoute(['CANDIDATE'])` guard, same `GET /api/v1/candidate/dashboard` fetch.
- No new routes. The intern-cycle pages (`/careers/intern/work`, `/careers/candidate/weekly-materials`, etc.) are unchanged — they're separate destinations the candidate navigates to via the sidebar / journey-bar links.

The journey bar uses `step.href` on each sub-step row to deep-link to the matching feature page (resume → openings, screening → `/careers/screening/{id}`, I-9 → `/careers/candidate/i9`, training plan → `/careers/candidate/training-plans`, etc.).

---

## Manual test steps (no JUnit harness)

> Local: `backend/run-dev.ps1` + `cd frontend && npm run dev`. Demo accounts from PRODUCT.md §14. `SPRING_PROFILES_ACTIVE` unset so demo seeders run.

### Test users (post-`SeedDemoDataExecutor`)

The demo seeder leaves these candidates at the relevant stages without manual setup:

| Email | Password | Seeded status | Maps to journey stage |
|---|---|---|---|
| `priya.sharma@example.com` | `demo12345` | Has APPLIED app (backend) AND OFFERED app (frontend) | `OFFER` (live SENT) — drives the urgent hero |
| `sarah.kim@example.com` | `demo12345` | APPLIED only | `APPLIED` — waiting on recruiter review |
| `aisha.patel@example.com` | `demo12345` | SHORTLISTED | `SCREENING` stage, waiting hero on recruiter scheduling |
| `marcus.chen@example.com` | `demo12345` | INTERVIEW_SCHEDULED + OFFERED | `OFFER` (live SENT) — urgent hero |
| `jamal.williams@example.com` | `demo12345` | INTERVIEW_SCHEDULED | `INTERVIEW` stage, action hero (attend interview) |
| `devon.king@example.com` | `demo12345` | INTERVIEWED | `INTERVIEW` stage, **waiting hero** on hiring team |
| `lin.zhou@example.com` | `demo12345` | ACCEPTED (no engagement seeded) | `OFFER` stage, sub-step waiting on engagement seed |
| `rachel.lee@example.com` | `demo12345` | REJECTED | `APPLIED` stage, journey.isExited=true, "Closed" pill |

To exercise the **STEM OPT onboarding sub-list**, manually create an engagement (no seeder does this — see the SQL in the earlier purge report). Set `engagement.track = 'STEM_OPT'` and `engagement.status = 'PENDING_COMPLIANCE'`, then refresh.

### T1 — Just applied (Sarah Kim) — waiting hero
1. Log in as `sarah.kim@example.com` / `demo12345` → `/careers/candidate`.
2. **Expected:**
   - Stage pill in header: `Applied`.
   - Journey bar: `Applied` dot is **current** (accent ring); other 5 dots upcoming. Sub-checklist for Applied shows: profile (current), resume (done), application submitted (done).
   - NextStep hero: sky-blue waiting variant, title "Your application is under review", `waitingFor` italic line "Recruiter reviewing your application", **no primary CTA**.
   - 3-up cards: application card shows "Backend Developer Intern" + status `APPLIED`; profile card shows progress %; resume card shows the seeded filename.

### T2 — Interview scheduled (Jamal Williams) — action hero
1. Log in as `jamal.williams@example.com`. The seed sets status to `INTERVIEW_SCHEDULED` but the seeder does **not** create an Interview row. To exercise this state end-to-end:
   - As `erm@skyzen.test`, schedule an interview for Jamal: `POST /api/v1/interviews` with `applicationId` = Jamal's app, future `scheduledAt`.
   - Refresh Jamal's dashboard.
2. **Expected:**
   - Stage pill: `Interview`.
   - Journey bar: Applied + Screening done; Interview current. Sub-step: "Interview scheduled — current, owner=You, subtitle=On [date]".
   - NextStep hero: accent variant, title "Interview scheduled — Backend Developer Intern", CTA "View details" → `/careers/candidate/interviews`. Not waiting.
   - Activity feed: status-change rows.

### T3 — Interview done, awaiting decision (Devon King) — waiting hero
1. Log in as `devon.king@example.com`. Seed has him at `INTERVIEWED`.
2. **Expected:**
   - Stage pill: `Interview`.
   - Journey bar: Applied + Screening done; Interview current. Sub-steps: "Interview completed — done, owner=You" + "Hiring decision — waiting, owner=Recruiter, subtitle=Team is reviewing your scorecard".
   - NextStep hero: **sky-blue waiting variant**, title "Interview complete — Backend Developer Intern", waitingFor: "Hiring team reviewing your scorecard".

### T4 — Offer live (Priya Sharma) — urgent hero
1. The seeded OFFERED apps for Priya + Marcus don't actually have Offer rows (seeder limitation). To exercise:
   - As `hr@skyzen.test`, `POST /api/v1/offers` for Priya's frontend OFFERED app (the OFFER_ALLOWED_FROM gate from A3 permits this since status=OFFERED). Then `POST /api/v1/offers/{id}/send`.
2. Log in as Priya, refresh `/careers/candidate`.
3. **Expected:**
   - Stage pill: `Offer`.
   - Journey bar: first 3 stages done; Offer current. Sub-step: "Review & respond to offer — current, owner=You, subtitle=Respond by [date]".
   - NextStep hero: **amber urgent variant**, title "You have an offer — Frontend Developer Intern", CTA "View offer".

### T5 — STEM OPT post-offer — onboarding sub-list
1. As Priya: accept the offer from T4 (`POST /api/v1/offers/{id}/accept`). The acceptance lifecycle creates an Engagement and routes the candidate to PENDING_COMPLIANCE.
2. Make sure Priya's `Candidate.expectedTrack = 'STEM_OPT'` (or set `engagement.track = 'STEM_OPT'` directly via SQL if registration didn't capture it):
   ```sql
   UPDATE candidates SET expected_track = 'STEM_OPT'
    WHERE user_id = (SELECT id FROM users WHERE email = 'priya.sharma@example.com');
   UPDATE engagements SET track = 'STEM_OPT'
    WHERE candidate_id = (SELECT id FROM candidates WHERE user_id =
       (SELECT id FROM users WHERE email = 'priya.sharma@example.com'));
   ```
3. Refresh Priya's dashboard.
4. **Expected:**
   - Stage pill: `Onboarding`.
   - Journey bar: first 4 stages done; Onboarding current; Hired upcoming. Sub-checklist (in this exact order for STEM_OPT):
     - **I-983 Training Plan** — current/waiting, owner=Employer (or DSO), href=`/careers/candidate/training-plans`
     - **Form I-9 — Section 1** — current, owner=You, href=`/careers/candidate/i9`
     - **Form I-9 — Section 2 (HR)** — upcoming, owner=Employer
     - **E-Verify** — upcoming, owner=Employer
     - **Onboarding tasks (N of M)** — current, owner=You, href=`/careers/candidate/onboarding`
   - NextStep hero: a single action (e.g. "Continue onboarding" if tasks incomplete, OR sky-blue "Onboarding compliance in progress" waiting variant when tasks done but HR pending).

### T6 — CPT track — no I-983 sub-step
1. Repeat T5 with `expected_track = 'CPT'` and `engagement.track = 'CPT'`.
2. **Expected:** sub-checklist replaces I-983 with **"DSO-authorized CPT on Form I-20"** (owner=Employer). No I-983 row. E-Verify only appears if a case actually exists.

### T7 — All apps exited (Rachel Lee) — terminal state
1. Log in as `rachel.lee@example.com`.
2. **Expected:**
   - Stage pill: red "Closed" pill.
   - Journey bar: first dot blocked (red triangle), rest upcoming. No expanded sub-list.
   - NextStep hero: accent variant, title "Find your next opportunity", CTA "Browse openings".

### T8 — Empty / first-time candidate
1. Register a fresh account; verify email; do NOT apply yet.
2. **Expected:** stage pill `Applied`, journey bar with Applied current showing 3 sub-steps (profile, resume, apply). Hero: "Complete your profile" if profile <100%, else "Browse open internships". Empty Upcoming + Recent activity sections render their copy.

### T9 — Notification bell
- Present in the header. Tooltip "Notifications — coming soon". Currently a placeholder; real unread-count requires the future `communications` table (GAP_REPORT C3). No-op click — does not crash.

### T10 — Responsiveness + light/dark
- Resize to mobile width: journey stage strip wraps (`flex-wrap`); 3-up cards stack to 1-col on `<sm`, 2-col on `sm`, 3-col on `lg`. The 2-col agenda section collapses to 1-col on `<lg`.
- Dark mode follows the existing theme — gray-100 / accent / amber tones already mode-neutral via Tailwind classes used in the rest of the app.

---

## What I deliberately did NOT change
- **Intern face** — out of scope per the task. The `HIRED` macro stage in `buildSubStepsFor` returns a single welcome/await-start row; the weekly cycle / setup sub-journeys live in a future intern-face shell that will reuse `JourneyBar` with a different stages payload.
- **`/careers/intern/work` page** — untouched. The intern face will eventually replace its content with the new shell, but that's Phase 2.
- **Sidebar** — untouched. The new `Weekly Materials` route (from the prior turn) is still not in the sidebar; same for any new intern surfaces. Cosmetic decision deferred.
- **`/api/v1/candidate/dashboard` endpoint URL + auth annotations** — same path, same role gate, same `@AuthenticationPrincipal` source (caller's own data only).
- **`ComplianceRoutingService`** — read-only consumer of `missingRequirements` semantics; no edits.
- **No new env vars, no new secrets, no schema changes** (`ddl-auto=update` doesn't trigger — purely additive DTO fields on an existing endpoint).

## Files touched (count)
- Backend new: 0
- Backend modified: 2 (DTO + service)
- Frontend new: 1 (JourneyBar component)
- Frontend modified: 2 (types append + candidate page rewrite)
- Total: 5 files
