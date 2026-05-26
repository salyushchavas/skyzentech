# Roles, Dashboards & Privileges Gap — vs PED §7

**Audit date:** 2026-05-23. Read-only. No code modified.
**Scope:** Only the dashboard/privilege layer. PED Section 7 ([.pedroadmap.txt:288-323](.pedroadmap.txt)) is the source of truth for the WHAT; [PRODUCT.md](PRODUCT%20%281%29.md) §2 is the source for the 6 backend roles.

> **Doc table caveat:** the Section-7 table rendering in the PED is mis-aligned — the **"User Role"** column labels ("Applicant before offer / Active intern", "HR and compliance admins / Program operations", "Supervisor/evaluator / Leadership") drift one row above their dashboards. This audit reads them in the obvious intended order: **Applicant** ← candidate-before-offer; **Intern** ← active intern; **HR/Compliance** ← HR/compliance admins; **Operations** ← program operations (RECRUITER + ERM in our codebase); **Technical Supervisor** ← supervisor/evaluator (TECHNICAL_EVALUATOR); **Executive** ← leadership/ADMIN.

---

## Role-to-dashboard mapping (overview)

The frontend role → landing route comes from [role-routing.ts:3-10](frontend/lib/role-routing.ts):

| PED dashboard | Backend role(s) | Frontend landing route | Sidebar definition |
|---|---|---|---|
| Applicant Dashboard | `CANDIDATE` (pre-hire) | [`/careers/candidate`](frontend/app/careers/(dashboard)/candidate/page.tsx) | [DashboardSidebar.tsx:36-47](frontend/components/dashboard/DashboardSidebar.tsx#L36-L47) |
| Intern Dashboard | `CANDIDATE` (engagement = ACTIVE) | **same** `/careers/candidate` + [`/careers/intern/work`](frontend/app/careers/intern/work/page.tsx) | same sidebar — both routes are present |
| HR / Compliance | `HR_COMPLIANCE` | [`/careers/hr`](frontend/app/careers/(dashboard)/hr/page.tsx) | [DashboardSidebar.tsx:60-67](frontend/components/dashboard/DashboardSidebar.tsx#L60-L67) |
| Operations | `RECRUITER` + `ERM` (split across two landing routes) | [`/careers/recruiter`](frontend/app/careers/(dashboard)/recruiter/page.tsx) (RECRUITER) + [`/careers/erm`](frontend/app/careers/(dashboard)/erm/page.tsx) (ERM) | [:48-51](frontend/components/dashboard/DashboardSidebar.tsx#L48-L51) + [:52-59](frontend/components/dashboard/DashboardSidebar.tsx#L52-L59) |
| Technical Supervisor | `TECHNICAL_EVALUATOR` | [`/careers/evaluator`](frontend/app/careers/(dashboard)/evaluator/page.tsx) | [:68-74](frontend/components/dashboard/DashboardSidebar.tsx#L68-L74) |
| Executive | `ADMIN` | [`/careers/admin`](frontend/app/careers/admin/page.tsx) | [:75-84](frontend/components/dashboard/DashboardSidebar.tsx#L75-L84) |

`getDashboardForUser` ([role-routing.ts:12-15](frontend/lib/role-routing.ts#L12-L15)) sends each user to their landing route on login. The "Operations" dashboard maps to **two** backend roles — RECRUITER for the day-to-day pipeline and ERM for the broader engagement/interview/I-983 management — which the PED's single "Operations" label collapses.

---

## 1. Applicant Dashboard (`CANDIDATE`, pre-offer)

**Mapping:** `/careers/candidate` ([candidate/page.tsx](frontend/app/careers/(dashboard)/candidate/page.tsx)) is the landing route. Backed by `GET /api/v1/candidate/dashboard` ([CandidateDashboardController.java:27](backend/src/main/java/com/skyzen/careers/controller/CandidateDashboardController.java#L27), `@PreAuthorize("hasRole('CANDIDATE')")` at :26).

### Widgets vs PED §7

PED expects: *Profile status, email verification, job postings, resume, application status, screening, interview schedule, messages.*

| Widget | Status | Evidence |
|---|---|---|
| Profile status | ✅ Present | `profileComplete` % rendered as the "Finish your profile" nudge — [candidate/page.tsx:147-149,262-279](frontend/app/careers/(dashboard)/candidate/page.tsx#L147-L149) |
| Email verification | ⚠ Partial | No tile on the dashboard. The state lives on `user.emailVerified` and the gate fires on apply ([ApplicationService.java:68-71](backend/src/main/java/com/skyzen/careers/service/ApplicationService.java#L68-L71)). Verify page exists at `/careers/verify-email`. No dashboard surface. |
| Job postings | ✅ Present | Empty-state CTA "Browse open internships" → `/careers/openings` ([candidate/page.tsx:194-208](frontend/app/careers/(dashboard)/candidate/page.tsx#L194-L208)). Public list endpoint `GET /api/v1/job-postings` (permitAll). |
| Resume | ⚠ Partial | No tile on the landing dashboard (intentional per PRODUCT.md §10 — "My Resumes removed"). Managed at apply time via the apply flow ([apply/page.tsx:70-81](frontend/app/careers/openings/[slug]/apply/page.tsx#L70-L81)) and on the candidate's Profile page. |
| Application status | ✅ Present | Application list with `StatusStepper` mini per row — [candidate/page.tsx:209-247](frontend/app/careers/(dashboard)/candidate/page.tsx#L209-L247). Backed by `applications` field on the aggregate response. |
| Screening | ⚠ Partial | No dedicated dashboard tile. Surfaced via "Next step" hero when screening is open ([candidate/page.tsx:380-381](frontend/app/careers/(dashboard)/candidate/page.tsx#L380-L381)). Standalone screening page at [`/careers/screening/[id]`](frontend/app/careers/(dashboard)/screening/[id]/page.tsx). |
| Interview schedule | ⚠ Partial | No dedicated dashboard tile. Upcoming interviews appear in the generic "Upcoming" sidebar ([candidate/page.tsx:280-296](frontend/app/careers/(dashboard)/candidate/page.tsx#L280-L296)). Standalone list at [`/careers/candidate/interviews/page.tsx`](frontend/app/careers/(dashboard)/candidate/interviews/page.tsx). |
| Messages | ❌ **Missing** | No `communications` entity, no messaging endpoint, no DM/inbox UI. (Feature not built — flagged in GAP_REPORT §3 as missing table `communications`.) |

### Privilege findings (CANDIDATE)

| Check | Result | Evidence |
|---|---|---|
| Sees only their own records | ✅ Pass for service-scoped reads. `GET /api/v1/candidate/dashboard` uses `@AuthenticationPrincipal User` — [CandidateDashboardController.java:27-29](backend/src/main/java/com/skyzen/careers/controller/CandidateDashboardController.java#L27-L29). `getMyForm`/`/me` endpoints all derive candidate from caller ([I9FormService.java:162-167](backend/src/main/java/com/skyzen/careers/service/I9FormService.java#L162-L167)). |
| Application reads | ✅ Pass — `ensureCanRead` in [ApplicationService.java:407-423](backend/src/main/java/com/skyzen/careers/service/ApplicationService.java#L407-L423) checks `application.candidate.user.id == caller.id` for non-privileged callers. |
| Resume download — owner only | ✅ Pass — `ensureCanDownload` in [ResumeController.java:83-99](frontend/components/dashboard/DashboardSidebar.tsx#L73). |
| Cross-candidate access | ✅ Blocked — `GET /api/v1/i9/{id}` etc. all run `requireReadAccess` ownership checks for CANDIDATE callers. |

**Tag:** Phase 1.

---

## 2. Intern Dashboard (`CANDIDATE`, engagement=ACTIVE)

**Mapping (the dashboard switch):** there is **NO explicit applicant→intern UI switch.** The same `/careers/candidate` landing route is used pre- and post-hire. The aggregate response ([candidate/page.tsx:83-92](frontend/app/careers/(dashboard)/candidate/page.tsx#L83-L92)) carries an `engagement` field; when non-null, the landing page's StatusStepper renders the "final stage" extension ([:228-243](frontend/app/careers/(dashboard)/candidate/page.tsx#L228-L243)) and a `ComplianceStatusCard` ([:252-254](frontend/app/careers/(dashboard)/candidate/page.tsx#L252-L254)) — but the intern-cycle widgets (assignments, timesheets, evaluations, weekly materials) live on **separate routes** the candidate must navigate to: [`/careers/intern/work`](frontend/app/careers/intern/work/page.tsx) for assignments + timesheets + evaluations, and [`/careers/candidate/weekly-materials`](frontend/app/careers/(dashboard)/candidate/weekly-materials/page.tsx) for materials. Both are surfaced in the sidebar ([DashboardSidebar.tsx:45](frontend/components/dashboard/DashboardSidebar.tsx#L45) for "My Work"; no sidebar entry for weekly materials yet — flagged in the C1/D4 commit doc).

### Widgets vs PED §7 (the "Intern Dashboard: Required Widgets" sub-table)

| Widget | Status | Evidence |
|---|---|---|
| Roadmap Timeline | ⚠ Partial | `StatusStepper` on candidate landing covers Applied→Hired ([candidate/page.tsx:227-243](frontend/app/careers/(dashboard)/candidate/page.tsx#L227-L243)); the post-hire weekly cycle / evaluation / completion phases are not surfaced as a single timeline widget. |
| Weekly Training Material | ✅ Present (NEW) | [`/careers/candidate/weekly-materials/page.tsx`](frontend/app/careers/(dashboard)/candidate/weekly-materials/page.tsx) + `GET /api/v1/weekly-materials/me`. Backend gated on `engagement.status == ACTIVE` in [WeeklyMaterialService.java](backend/src/main/java/com/skyzen/careers/service/WeeklyMaterialService.java) `requireActiveEngagement`. |
| Project Assignment Board | ✅ Present | "Assignments" section in [intern/work/page.tsx:288-371](frontend/app/careers/intern/work/page.tsx#L288-L371). Backed by `GET /api/v1/supervised/my/assignments` ([WorkAssignmentController.java:50-53](backend/src/main/java/com/skyzen/careers/controller/WorkAssignmentController.java#L50)). |
| GitHub Activity | ❌ **Missing** | No GitHub integration. Onboarding has a generic `GITLAB_ACCESS` checklist item ([OnboardingService.java:131-139](backend/src/main/java/com/skyzen/careers/service/OnboardingService.java#L131-L139)) — that's a checkbox, not a repo/commits widget. (Feature not built — flagged in GAP_REPORT D2.) |
| Weekly Report | ⚠ Partial | No separate `weekly_reports` entity (flagged in GAP_REPORT §3). The narrative is folded into `Timesheet.description` ([Timesheet.java:52-53](backend/src/main/java/com/skyzen/careers/entity/Timesheet.java#L52-L53)). |
| Timesheet | ✅ Present | "Timesheets" section in [intern/work/page.tsx:374-468](frontend/app/careers/intern/work/page.tsx#L374-L468). Backed by `GET /api/v1/supervised/my/timesheets`. |
| Acknowledgment Center | ⚠ Partial | `material_acknowledgements` exists (C1 commit) but only for weekly materials. Onboarding tasks have a "complete" status. No unified "Acknowledgment Center" page collating policy/hierarchy/GitHub-rules/training-plan acknowledgments. |
| Evaluations | ✅ Present | "Evaluations" section in [intern/work/page.tsx:470-538](frontend/app/careers/intern/work/page.tsx#L470-L538). Backed by `GET /api/v1/supervised/my/evaluations`. |

### Privilege findings (intern same as candidate)
Same set as §1 above — there is no separate "INTERN" role.

**Tag:** Phase 2.

---

## 3. HR / Compliance Dashboard (`HR_COMPLIANCE`)

**Mapping:** `/careers/hr` ([hr/page.tsx](frontend/app/careers/(dashboard)/hr/page.tsx)). Compliance overview at `/careers/hr/compliance` backed by `GET /api/v1/compliance/overview` ([ComplianceOverviewController.java:19](backend/src/main/java/com/skyzen/careers/controller/ComplianceOverviewController.java#L19), `@PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ADMIN')")`).

### Widgets vs PED §7
PED expects: *Offer status, I-983 status, I-9 metadata, E-Verify status, authorization expiry reminders, TNC workflow flag, audit log.*

| Widget | Status | Evidence |
|---|---|---|
| Offer status | ✅ Present | [`/careers/hr/offers/page.tsx`](frontend/app/careers/(dashboard)/hr/offers/page.tsx) + `GET /api/v1/offers` (HR_COMPLIANCE allowed per controller). |
| I-983 status | ✅ Present | I-983 plans surfaced via `GET /api/v1/i983` (HR_COMPLIANCE allowed at [I983Controller.java:46](backend/src/main/java/com/skyzen/careers/controller/I983Controller.java#L46)) — but actual page lives under `/careers/erm/training-plans` (no HR-side page). |
| I-9 metadata | ✅ Present | [`/careers/hr/i9-everify/page.tsx`](frontend/app/careers/(dashboard)/hr/i9-everify/page.tsx) + `GET /api/v1/i9` ([I9Controller.java:57](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L57)). Detail at `/careers/hr/i9-everify/i9/[id]`. |
| E-Verify status | ✅ Present | E-Verify cases listed via `GET /api/v1/everify` ([EVerifyController.java:46](backend/src/main/java/com/skyzen/careers/controller/EVerifyController.java#L46)). Detail at `/careers/hr/i9-everify/everify/[id]`. |
| Authorization expiry reminders | ⚠ Partial | `UpcomingDeadline` model exists in [dto/compliance/UpcomingDeadline.java](backend/src/main/java/com/skyzen/careers/dto/compliance/UpcomingDeadline.java); ComplianceOverview returns them. No dedicated expiry dashboard widget — they're folded into "alerts". |
| TNC workflow flag (Tentative Nonconfirmation) | ⚠ Partial | `EVerifyStatus.TENTATIVE_NONCONFIRMATION` exists ([EVerifyStatus.java:7](backend/src/main/java/com/skyzen/careers/enums/EVerifyStatus.java#L7)) and surfaces as a status badge. No "TNC workflow" guided process / explicit dashboard tile. |
| Audit log | ❌ **Missing for HR** | Audit log viewer exists at `/careers/admin/audit-log` ([AdminInsightsController.java:36](backend/src/main/java/com/skyzen/careers/controller/AdminInsightsController.java#L36)) but is `hasRole('ADMIN')`. HR has no audit-log access. |

### Privilege findings (HR_COMPLIANCE)

| Check | Result | Evidence |
|---|---|---|
| HR sees full I-9 PII | ✅ Pass — `GET /api/v1/i9/candidate/{candidateId}` and `GET /api/v1/i9/{id}` return the full `I9FormResponse` including ssn/dateOfBirth/alienRegistrationNumber after the C7 converter transparently decrypts ([I9Controller.java:40-44](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L40-L44)). |
| Section 2 write | ✅ Pass — `POST /api/v1/i9/{id}/section2` is `hasAnyRole('HR_COMPLIANCE', 'ADMIN')` ([I9Controller.java:79](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L79)). |

**Privilege violation (cross-role I-9 PII leak):** `GET /api/v1/i9/{id}` at [I9Controller.java:48](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L48) is `hasAnyRole('CANDIDATE', 'RECRUITER', 'ERM', 'HR_COMPLIANCE', 'TECHNICAL_EVALUATOR', 'ADMIN')` and returns the **full** `I9FormResponse` (ssn, DOB, A-number, doc numbers). Cross-references the encryption converter that auto-decrypts on read. See §4 below — this is a **TOO LOOSE** finding against the doc's "only HR_COMPLIANCE should see full I-9 PII" rule.

**Tag:** Phase 1 (offers, I-9 readiness) + Phase 2 (E-Verify, ongoing compliance health).

---

## 4. Operations Dashboard (`RECRUITER` + `ERM`)

**Mapping:** the PED collapses two backend roles into one "Operations" dashboard. Each role has a separate landing route:
- **RECRUITER** → `/careers/recruiter` ([recruiter/page.tsx](frontend/app/careers/(dashboard)/recruiter/page.tsx)) — Kanban + table pipeline, backed by `GET /api/v1/applications` (`@PreAuthorize` at [ApplicationController.java:73](backend/src/main/java/com/skyzen/careers/controller/ApplicationController.java#L73) allows RECRUITER/ERM/HR_COMPLIANCE/ADMIN).
- **ERM** → `/careers/erm` ([erm/page.tsx](frontend/app/careers/(dashboard)/erm/page.tsx)) — engagement and interview management.

### Widgets vs PED §7
PED expects: *Pipeline, job postings, interview queue, onboarding queue, missing tasks, email log, weekly submissions.*

| Widget | Status | Evidence |
|---|---|---|
| Pipeline | ✅ Present | Kanban + table at [recruiter/page.tsx](frontend/app/careers/(dashboard)/recruiter/page.tsx). |
| Job postings | ✅ Present (for ERM) | `POST/PUT/PATCH /api/v1/job-postings` allowed for ERM/ADMIN at [JobPostingController.java:70,80,87](backend/src/main/java/com/skyzen/careers/controller/JobPostingController.java#L70). Page at `/careers/admin/postings` is ADMIN-only — no ERM-facing posting management page. |
| Interview queue | ✅ Present (ERM) | [`/careers/erm/interviews/page.tsx`](frontend/app/careers/(dashboard)/erm/interviews/page.tsx) + `GET /api/v1/interviews` ([InterviewController.java:48](backend/src/main/java/com/skyzen/careers/controller/InterviewController.java#L48)). |
| Onboarding queue | ⚠ Partial | `GET /api/v1/onboarding/candidate/{candidateId}` allowed for HR_COMPLIANCE/ERM/ADMIN ([OnboardingController.java:51](backend/src/main/java/com/skyzen/careers/controller/OnboardingController.java#L51)). No dedicated "onboarding queue" dashboard view — it's looked up per-candidate. |
| Missing tasks | ❌ **Missing** | No aggregate "what's overdue across the org" view. ComplianceOverview surfaces some (HR-only). |
| Email log | ❌ **Missing** | No `communications` entity; `NotificationStub` ([NotificationStub.java](backend/src/main/java/com/skyzen/careers/notification/NotificationStub.java)) only logs at INFO. (Feature not built — GAP_REPORT C3.) |
| Weekly submissions | ❌ **Missing** | No org-wide weekly-submission roll-up for operations. Supervisors see per-intern via Evaluator page. |

### Privilege findings (RECRUITER, ERM)

| Check | Result | Evidence |
|---|---|---|
| RECRUITER sees I-9 PII | ❌ **TOO LOOSE** | `GET /api/v1/i9/{id}` allows RECRUITER ([I9Controller.java:48](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L48)), returns SSN + DOB + A-number after C7 decrypt. PED §7 explicitly says I-9 metadata is HR/Compliance — RECRUITER should NOT see PII. Hiding is also frontend-only — there's no RECRUITER-facing I-9 page, but a recruiter could `curl` the endpoint with their JWT and get plaintext PII. |
| ERM sees I-9 PII | ❌ **TOO LOOSE** | Same endpoint allows ERM. PED puts I-9 metadata in HR. ERM should not see PII. |
| ERM sees I-983 plans | ✅ Pass | I-983 is shared by HR + ERM per the doc; `GET /api/v1/i983` allows ERM ([I983Controller.java:46](backend/src/main/java/com/skyzen/careers/controller/I983Controller.java#L46)). |
| RECRUITER offer creation | ❌ **TOO TIGHT** (depending on read) | `POST /api/v1/offers` is `hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')` ([OfferController.java:47](backend/src/main/java/com/skyzen/careers/controller/OfferController.java#L47)) — RECRUITER cannot create offers. PED isn't explicit; if the intent is recruiter-driven offers, this is too tight. If HR/ERM-only, it matches. |
| Candidate detail read | ✅ Pass | `GET /api/v1/candidates/{id}` allows RECRUITER/ERM/HR_COMPLIANCE/ADMIN ([CandidatesController.java:45](backend/src/main/java/com/skyzen/careers/controller/CandidatesController.java#L45)) — fine for ops. |
| Resume download | ✅ Pass (post-A6) | `GET /api/v1/resumes/{id}/download` is `hasAnyRole('CANDIDATE', 'RECRUITER', 'ERM', 'ADMIN')` ([ResumeController.java:47-48](frontend/components/dashboard/DashboardSidebar.tsx#L73)) plus row-level `ensureCanDownload`. |

**Tag:** Phase 1.

---

## 5. Technical Supervisor Dashboard (`TECHNICAL_EVALUATOR`)

**Mapping:** `/careers/evaluator` ([evaluator/page.tsx](frontend/app/careers/(dashboard)/evaluator/page.tsx)) backed by `GET /api/v1/supervised/evaluator/dashboard` ([EvaluatorController.java:34-38](backend/src/main/java/com/skyzen/careers/controller/EvaluatorController.java#L34-L38)). The dashboard payload is **strictly scoped to the authenticated evaluator** — `EvaluatorListsService.listInterns(...)` and friends call `applicationRepository.findHiredInternsForEvaluator(evaluator.getId())` ([EvaluatorListsService.java:51-55,80-81](backend/src/main/java/com/skyzen/careers/service/EvaluatorListsService.java#L51-L55)). Good.

### Widgets vs PED §7
PED expects: *Assigned interns, weekly assignments, GitHub/project submissions, timesheet approvals, feedback, evaluation forms.*

| Widget | Status | Evidence |
|---|---|---|
| Assigned interns | ✅ Present (scoped) | [`/careers/evaluator/interns/page.tsx`](frontend/app/careers/(dashboard)/evaluator/interns/page.tsx) + `GET /api/v1/supervised/evaluator/interns` scoped to caller ([EvaluatorController.java:40-44](backend/src/main/java/com/skyzen/careers/controller/EvaluatorController.java#L40-L44)). |
| Weekly assignments | ✅ Present | [`/careers/evaluator/assignments/page.tsx`](frontend/app/careers/(dashboard)/evaluator/assignments/page.tsx) + `GET /api/v1/supervised/evaluator/assignments` scoped to caller ([EvaluatorController.java:52-58](backend/src/main/java/com/skyzen/careers/controller/EvaluatorController.java#L52-L58)). |
| GitHub/project submissions | ⚠ Partial | Assignments carry `submissionLink` (free-text URL) — [WorkAssignment.java:69-71](backend/src/main/java/com/skyzen/careers/entity/WorkAssignment.java#L69-L71). No GitHub integration / PR-level tracking. (Feature not built.) |
| Timesheet approvals | ✅ Present | `POST /api/v1/supervised/timesheets/{id}/approve` allowed for TECHNICAL_EVALUATOR ([TimesheetController.java:71-73](backend/src/main/java/com/skyzen/careers/controller/TimesheetController.java#L71-L73)). |
| Feedback | ✅ Present | `POST /api/v1/supervised/assignments/{id}/review` ([WorkAssignmentController.java:71-74](backend/src/main/java/com/skyzen/careers/controller/WorkAssignmentController.java#L71-L74)) accepts free-text review notes. |
| Evaluation forms | ✅ Present | `POST /api/v1/supervised/evaluations/{id}/complete` ([EvaluationSessionController.java:65](backend/src/main/java/com/skyzen/careers/controller/EvaluationSessionController.java#L65)) with strengths / areas / rating. |

### Privilege findings (TECHNICAL_EVALUATOR)

| Check | Result | Evidence |
|---|---|---|
| Evaluator sees only ASSIGNED interns (per-dashboard) | ✅ Pass on the **evaluator** endpoints | All `/api/v1/supervised/evaluator/*` filter by `assignedEvaluator = caller` ([EvaluatorListsService.java:51-71](backend/src/main/java/com/skyzen/careers/service/EvaluatorListsService.java#L51-L71)). |
| Evaluator sees only ASSIGNED interns (org-wide) | ❌ **TOO LOOSE** | `GET /api/v1/supervised/interns` at [SupervisedInternsController.java:27-33](backend/src/main/java/com/skyzen/careers/controller/SupervisedInternsController.java#L27-L33) allows TECHNICAL_EVALUATOR and returns **all hired interns**, not just the evaluator's assigned set. The sidebar exposes this via `/careers/supervised` for TECHNICAL_EVALUATOR ([DashboardSidebar.tsx:73](frontend/components/dashboard/DashboardSidebar.tsx#L73)). |
| Evaluator sees I-9 PII | ❌ **TOO LOOSE** | `GET /api/v1/i9/{id}` allows TECHNICAL_EVALUATOR ([I9Controller.java:48](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L48)). Returns SSN/DOB/A-number after C7 decrypt. No UI route surfaces it, but the endpoint is reachable with the JWT. PED keeps I-9 metadata in HR — TECHNICAL_EVALUATOR should not see PII. **Hiding-only-not-enforced.** |
| Evaluator approves another evaluator's timesheet | ⚠ Loose | `POST /api/v1/supervised/timesheets/{id}/approve` allows any TECHNICAL_EVALUATOR/ERM/ADMIN with no row-level "is this intern assigned to me?" gate — service doesn't appear to check. (Not explicitly verified against TimesheetService here; flagged as worth confirming.) |

**Tag:** Phase 2.

---

## 6. Executive Dashboard (`ADMIN`)

**Mapping:** `/careers/admin` ([admin/page.tsx](frontend/app/careers/admin/page.tsx)) backed by `GET /api/v1/admin/overview` ([AdminInsightsController.java:30](backend/src/main/java/com/skyzen/careers/controller/AdminInsightsController.java#L30), `@PreAuthorize("hasRole('ADMIN')")`).

### Widgets vs PED §7
PED expects: *Funnel metrics, active interns, completion rate, weekly compliance health, delayed submissions, supervisor workload.*

| Widget | Status | Evidence |
|---|---|---|
| Funnel metrics | ⚠ Partial | `AdminOverviewResponse` returns application-status counts ([AdminOverviewService.java](backend/src/main/java/com/skyzen/careers/service/AdminOverviewService.java) via the controller). No stage-transition timing / drop-off rate / source-of-hire breakdown. |
| Active interns | ✅ Present | `EngagementRepository.countByStatusIn` exists ([EngagementRepository.java:54-61](backend/src/main/java/com/skyzen/careers/repository/EngagementRepository.java#L54-L61)) and the admin overview surfaces counts. |
| Completion rate | ❌ **Missing** | No completion-rate / time-to-hire metric. Engagement has `COMPLETED` status but no rate aggregation. |
| Weekly compliance health | ⚠ Partial | Compliance counts surface for HR via `/api/v1/compliance/overview`. Admin's `/overview` doesn't include a compliance-health card. |
| Delayed submissions | ❌ **Missing** | No org-wide overdue-tasks roll-up. |
| Supervisor workload | ❌ **Missing** | No supervisor-load aggregate (assignments-per-evaluator / open-reviews-per-supervisor). |

### Privilege findings (ADMIN)

| Check | Result | Evidence |
|---|---|---|
| Full/system view | ✅ Pass | Admin endpoints (`/api/v1/admin/users`, `/api/v1/admin/entities`, `/api/v1/admin/overview`, `/api/v1/admin/audit-log`) all `hasRole('ADMIN')`. |
| Audit log access | ✅ Pass — admin-only | `GET /api/v1/admin/audit-log` at [AdminInsightsController.java:36](backend/src/main/java/com/skyzen/careers/controller/AdminInsightsController.java#L36). |
| ADMIN can edit I-9 Section 1 | ✅ Pass — corrective action path | `@PreAuthorize("hasAnyRole('CANDIDATE', 'ADMIN')")` at [I9Controller.java:71](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L71). The A1 gate also bypasses for ADMIN ([I9FormService.java:201-204](backend/src/main/java/com/skyzen/careers/service/I9FormService.java#L201-L204)). |

**Tag:** Phase 2 (Executive metrics is post-funnel — most widgets require the cycle to be running).

---

## Applicant → Intern transition

**Confirmed: there is NO explicit switch.** The candidate uses the same `/careers/candidate` landing route through the entire lifecycle. Three things change as the candidate progresses:

1. **Backend dashboard payload** ([CandidateDashboardService](backend/src/main/java/com/skyzen/careers/service/CandidateDashboardService.java) → response shape at [candidate/page.tsx:83-92](frontend/app/careers/(dashboard)/candidate/page.tsx#L83-L92)) starts including `engagement` and `compliance` fields once an Engagement exists for the candidate. The frontend conditionally renders `ComplianceStatusCard` only when `data.compliance && data.compliance.length > 0` ([candidate/page.tsx:252-254](frontend/app/careers/(dashboard)/candidate/page.tsx#L252-L254)), and extends the StatusStepper's final stage when `data.engagement.applicationId === a.id` ([:231-242](frontend/app/careers/(dashboard)/candidate/page.tsx#L231-L242)).

2. **Backend visibility gates flip on** as the engagement moves through statuses:
   - `engagement.status == ACTIVE` unlocks weekly materials ([WeeklyMaterialService.java](backend/src/main/java/com/skyzen/careers/service/WeeklyMaterialService.java) `requireActiveEngagement`).
   - An accepted offer unlocks I-9 (A1 gate in [I9FormService.java:170-179](backend/src/main/java/com/skyzen/careers/service/I9FormService.java#L170-L179)).
   - STEM_OPT track unlocks I-983 (A5 gate).

3. **Sidebar is static** — [DashboardSidebar.tsx:36-47](frontend/components/dashboard/DashboardSidebar.tsx#L36-L47) shows ALL ten CANDIDATE links to every candidate regardless of phase: Open Internships + My Applications (applicant-phase) AND My Work + Training Plan + I-9 (intern-phase). Each target page renders its own "available after offer / once active" empty state when accessed pre-condition.

**Net:** the codebase treats Applicant and Intern as a **single dashboard with phase-conditional content**, not as two dashboards with an explicit switch. This works, but it diverges from PED §7's "Applicant Dashboard / Intern Dashboard" framing — there is no role flip, no dashboard route swap, and the sidebar shows the same set of tiles throughout. The "switch" is implicit in (a) which dashboard tiles light up and (b) which target pages render their happy-path vs empty-state UIs.

---

## Prioritized fix list — phase-grouped

### Phase 1 (register → hired)

1. **HR_COMPLIANCE / RECRUITER / ERM / TECHNICAL_EVALUATOR** — narrow `GET /api/v1/i9/{id}` to `HR_COMPLIANCE`/`ADMIN` only (currently allows 5 roles → leaks SSN/DOB) — [I9Controller.java:48](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L48). **S**
2. **HR_COMPLIANCE / TECHNICAL_EVALUATOR / RECRUITER / ERM** — same fix for `GET /api/v1/i9/{id}/history` (also leaks PII via audit snapshots) — [I9Controller.java:95](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L95). **S**
3. **CANDIDATE** — add an "Email verification" widget to the applicant landing dashboard (currently only the apply-gate enforces it; no dashboard surface) — [candidate/page.tsx](frontend/app/careers/(dashboard)/candidate/page.tsx). **S**
4. **CANDIDATE** — add a "Messages" inbox surface (broader feature; backed by missing `communications` entity from GAP_REPORT §3). **L**
5. **CANDIDATE** — surface "Resume" status as a dashboard tile (currently a Profile-page-only management surface). **S**
6. **HR_COMPLIANCE** — give HR an audit-log viewer (currently ADMIN-only). Either widen `/api/v1/admin/audit-log` or add `/api/v1/compliance/audit-log` scoped to compliance entities. **M**
7. **HR_COMPLIANCE** — dedicated authorization-expiry reminders widget (currently merged into generic alerts). **S**
8. **HR_COMPLIANCE** — dedicated TNC workflow widget for the I-9/E-Verify hub. **M**
9. **RECRUITER / ERM** — operations "Missing tasks" + "Onboarding queue" aggregate views (currently per-candidate only). **M**
10. **RECRUITER / ERM** — "Email log" view (waits on `communications` entity). **L**
11. **ADMIN** — admin-side posting CRUD already exists at `/careers/admin/postings`; if ERM should also manage postings on their dashboard (PED §7 "Operations: job postings"), add an ERM-facing page wrapping the same `JobPostingController` endpoints. **S**

### Phase 2 (hired → complete)

12. **TECHNICAL_EVALUATOR** — block evaluator access to `GET /api/v1/supervised/interns` (the org-wide hired-intern list). Either narrow `@PreAuthorize` to ERM/HR/ADMIN, or scope the service by caller — [SupervisedInternsController.java:27-33](backend/src/main/java/com/skyzen/careers/controller/SupervisedInternsController.java#L27-L33). Also remove the `Supervised` sidebar link for TECHNICAL_EVALUATOR ([DashboardSidebar.tsx:73](frontend/components/dashboard/DashboardSidebar.tsx#L73)). **S**
13. **TECHNICAL_EVALUATOR** — confirm row-level "is this intern assigned to me?" check on `POST /api/v1/supervised/timesheets/{id}/approve` + `POST /api/v1/supervised/assignments/{id}/review`. If absent, add it. **M**
14. **CANDIDATE** — single "Roadmap Timeline" widget covering Applied → Hired → ACTIVE → Completion (currently StatusStepper handles 0-4 only; post-hire phases live on a separate page). **M**
15. **CANDIDATE** — surface "Weekly Materials" in the sidebar (the page exists at `/careers/candidate/weekly-materials` but isn't linked yet — flagged in the C1/D4 commit doc). **S**
16. **CANDIDATE** — implement Acknowledgment Center: unified list of policy / hierarchy / GitHub-rules / training-plan acks (currently only material acks exist). **M**
17. **CANDIDATE** — separate `weekly_reports` entity (currently folded into `Timesheet.description`). Backed by GAP_REPORT C2. **M**
18. **CANDIDATE / TECHNICAL_EVALUATOR** — GitHub integration: repo invite, PR/commit summary widget on intern + supervisor dashboards. Backed by GAP_REPORT D2. **L**
19. **HR_COMPLIANCE** — add an HR-side I-983 management page (currently lives under `/careers/erm/training-plans` — ERM owns it, HR shares the data per PED). **S**
20. **ADMIN** — Executive dashboard widgets: completion rate, delayed-submissions roll-up, supervisor workload. **M**
21. **ADMIN** — weekly compliance health card on `/careers/admin` (currently only HR sees compliance health). **S**

---

**Audit complete, no files modified.**
