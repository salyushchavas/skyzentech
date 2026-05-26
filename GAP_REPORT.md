# Skyzen Careers — Read-Only Gap Audit vs PED Roadmap

**Audit date:** 2026-05-22
**Sources of truth:** `PRODUCT (1).md` (HOW) + `Anvi_Internship_Dashboard_Roadmap.pdf` (WHAT — to be rebranded Skyzen).
**Scope:** read-only. No code modified. Evidence cited as `path:line`.

---

## 1. Codebase Inventory

### 1.1 JPA Entities (21)

| Entity | File | Role |
|---|---|---|
| User | [User.java](backend/src/main/java/com/skyzen/careers/entity/User.java) | Auth principal; carries `emailVerified`, `applicantId` (SKZ-INT-YYYY-NNNNNN), roles `Set<UserRole>`. |
| Candidate | [Candidate.java](backend/src/main/java/com/skyzen/careers/entity/Candidate.java) | Applicant profile + work-auth self-attestation (legalName, education, school, degree, skillset, authorizedToWork, sponsorshipNeeded, expectedTrack, validityDate). |
| StaffingEntity | [StaffingEntity.java](backend/src/main/java/com/skyzen/careers/entity/StaffingEntity.java) | Hiring entity (multi-entity ATS support). |
| JobPosting | [JobPosting.java](backend/src/main/java/com/skyzen/careers/entity/JobPosting.java) | Posting with status (DRAFT/OPEN/CLOSED), employmentType (INTERNSHIP/…). |
| Resume | [Resume.java](backend/src/main/java/com/skyzen/careers/entity/Resume.java) | Uploaded resume; file lives on `/data/resumes`. |
| Application | [Application.java](backend/src/main/java/com/skyzen/careers/entity/Application.java) | Application row with `ApplicationStatus`, recruiter notes + rating. |
| Screening | [Screening.java](backend/src/main/java/com/skyzen/careers/entity/Screening.java) | 1:1 web screening per Application; SENT → COMPLETED, score/maxScore. |
| ScreeningQuestion | [ScreeningQuestion.java](backend/src/main/java/com/skyzen/careers/entity/ScreeningQuestion.java) | Seeded question bank. |
| ScreeningAnswer | [ScreeningAnswer.java](backend/src/main/java/com/skyzen/careers/entity/ScreeningAnswer.java) | Candidate's answers. |
| Interview | [Interview.java](backend/src/main/java/com/skyzen/careers/entity/Interview.java) | Schedule + scorecard (overall/tech/comm/problem-solving + recommendation). |
| Offer | [Offer.java](backend/src/main/java/com/skyzen/careers/entity/Offer.java) | DRAFT/SENT/ACCEPTED/DECLINED/EXPIRED/REVOKED + letterContent. |
| Engagement | [Engagement.java](backend/src/main/java/com/skyzen/careers/entity/Engagement.java) | Phase-3 post-offer employment record; snapshots `track`, carries planned/actual start dates + supervisor. |
| OnboardingTask | [OnboardingTask.java](backend/src/main/java/com/skyzen/careers/entity/OnboardingTask.java) | Per-candidate per-offer onboarding checklist. |
| I9Form | [I9Form.java](backend/src/main/java/com/skyzen/careers/entity/I9Form.java) | I-9 Section 1+2 fields stored *in full* (PII heavy), `section1DueDate`/`section2DueDate`. |
| I983Plan | [I983Plan.java](backend/src/main/java/com/skyzen/careers/entity/I983Plan.java) | STEM OPT training plan with employer/student signatures + DSO submission tracking. |
| EVerifyCase | [EVerifyCase.java](backend/src/main/java/com/skyzen/careers/entity/EVerifyCase.java) | 1:1 with I-9; status, dueBy (day 3), closure reason. |
| WorkAssignment | [WorkAssignment.java](backend/src/main/java/com/skyzen/careers/entity/WorkAssignment.java) | Weekly assignments (intern, assignedBy, weekOf, dueDate, submission). |
| Timesheet | [Timesheet.java](backend/src/main/java/com/skyzen/careers/entity/Timesheet.java) | Per-week hours, approvedBy. |
| EvaluationSession | [EvaluationSession.java](backend/src/main/java/com/skyzen/careers/entity/EvaluationSession.java) | Evaluator session with rating/strengths/areas. |
| AuditLog | [AuditLog.java](backend/src/main/java/com/skyzen/careers/entity/AuditLog.java) | Before/after JSON, userId, action, entityType+entityId, ipAddress (NEVER POPULATED). |
| PasswordResetToken | [PasswordResetToken.java](backend/src/main/java/com/skyzen/careers/entity/PasswordResetToken.java) | One-time reset link token. |

### 1.2 Repositories (26)
Spring Data JPA repos for every entity above; plus three Specifications:
- [ApplicationSpecifications.java](backend/src/main/java/com/skyzen/careers/repository/ApplicationSpecifications.java) — composable filters w/ fetch-joins.
- [InterviewSpecifications.java](backend/src/main/java/com/skyzen/careers/repository/InterviewSpecifications.java) — interview-list filters.
- [JobPostingSpecifications.java](backend/src/main/java/com/skyzen/careers/repository/JobPostingSpecifications.java), [CandidateSpecifications.java](backend/src/main/java/com/skyzen/careers/repository/CandidateSpecifications.java), [AuditLogSpecifications.java](backend/src/main/java/com/skyzen/careers/repository/AuditLogSpecifications.java).

### 1.3 Services (29)
ApplicationService, ApplicantIdGenerator, AdminAuditLogService, AdminEntityService, AdminOverviewService, AdminUserService, AuthService, CandidateApplicationsService, CandidateDashboardService, CandidatesService, ComplianceOverviewService, ComplianceRoutingService, DocumentService, EngagementService, EVerifyService, EvaluatorListsService, EvaluationSessionService, I9FormService, I983Service, InterviewService, JobPostingService, OfferService, OfferLetterTemplate, OnboardingService, ResumeService, ScreeningService, SupervisedInternsService, SupervisedOverviewService, TimesheetService, UserProfileService, WorkAssignmentService.

### 1.4 Controllers (26) — see §4 for details.

### 1.5 Frontend (Next.js App Router) — key routes
- Public: `/careers/login`, `/careers/register`, `/careers/forgot-password`, `/careers/reset-password`, `/careers/verify-email`, `/careers/openings`, `/careers/openings/[slug]`, `/careers/openings/[slug]/apply`.
- Candidate: `/careers/candidate`, `/careers/candidate/applications`, `/careers/candidate/interviews`, `/careers/candidate/offers`, `/careers/candidate/offers/[id]`, `/careers/candidate/profile`, `/careers/candidate/i9`, `/careers/candidate/onboarding`, `/careers/candidate/training-plans`, `/careers/candidate/training-plans/[id]`.
- Recruiter: `/careers/recruiter`, `/careers/recruiter/candidates`, `/careers/recruiter/candidates/[id]`, `/careers/recruiter/applications/[id]`.
- ERM: `/careers/erm`, `/careers/erm/interviews`, `/careers/erm/interviews/new`, `/careers/erm/interviews/[id]`, `/careers/erm/training-plans`, `/careers/erm/training-plans/new`, `/careers/erm/training-plans/[id]`.
- Evaluator: `/careers/evaluator`, `/careers/evaluator/assignments`, `/careers/evaluator/interns`, `/careers/evaluator/sessions`.
- HR: `/careers/hr`, `/careers/hr/compliance`, `/careers/hr/documents`, `/careers/hr/i9-everify`, `/careers/hr/i9-everify/i9/[id]`, `/careers/hr/i9-everify/everify/[id]`, `/careers/hr/offers`, `/careers/hr/offers/new`, `/careers/hr/offers/[id]`, `/careers/hr/offers/[id]/edit`.
- Admin: `/careers/admin`, `/careers/admin/audit-log`, `/careers/admin/entities`, `/careers/admin/postings`, `/careers/admin/users`.
- Supervised: `/careers/supervised`, `/careers/supervised/[candidateId]`.

### 1.6 Orphan / un-mapped code
- **WorkAuthTrack.java** enum exists with values used in routing but no surfaced API to list them — fine, used internally.
- **OfferLetterTemplate** generates a TXT body, not PDF. The PED implies offer letters; PRODUCT.md §11 acknowledges "real PDF offer letters" pending.
- **NotificationStub** ([NotificationStub.java](backend/src/main/java/com/skyzen/careers/notification/NotificationStub.java)) — logs INFO only. No real email send, no `communications` durability.
- **AuditLog.ipAddress** column ([AuditLog.java:39](backend/src/main/java/com/skyzen/careers/entity/AuditLog.java#L39)) exists but never populated by any write site.
- **Various Bootstrap seeders** — production demo-data seeders run on startup (`SeedDemoDataRunner`, `SeedJobPostingsRunner`, `RoleTestUsersSeeder`). These exist but are not PED-required; should be gated to dev profiles.

---

## 2. State Machine Audit (HIGHEST PRIORITY)

### 2.1 PED's 26 Status Codes → Code Mapping

| PED code | In code? | Where | Transition gated? |
|---|---|---|---|
| APPLICATION_DRAFT | ❌ Not modeled | — | n/a — application row only exists once submitted. |
| APPLICATION_SUBMITTED | ✅ as `APPLIED` | [ApplicationStatus.java:4](backend/src/main/java/com/skyzen/careers/enums/ApplicationStatus.java#L4) | Gated by `LEGAL_TRANSITIONS` ([ApplicationLifecycle.java:84](backend/src/main/java/com/skyzen/careers/application/ApplicationLifecycle.java#L84)). |
| EMAIL_VERIFICATION_PENDING | ⚠️ Implicit | `User.emailVerified=false` ([User.java:60-63](backend/src/main/java/com/skyzen/careers/entity/User.java#L60-L63)); audit action `EMAIL_VERIFICATION_PENDING` ([AuthService.java:99](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L99)). | Set on register. |
| EMAIL_VERIFIED | ⚠️ Implicit | `emailVerified=true` + audit `EMAIL_VERIFIED` ([AuthService.java:138-142](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L138-L142)). | Code/expiry validated. |
| ANVI_ID_CREATED | ⚠️ Implicit | `applicantId` SKZ-INT-YYYY-NNNNNN + audit `APPLICANT_ID_CREATED` ([AuthService.java:151-156](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L151-L156)). | Atomic w/ verify. |
| JOB_POSTINGS_UNLOCKED | ❌ Not a status; implicit via `emailVerified`. | `ApplicationService.apply` blocks unverified ([ApplicationService.java:68-71](backend/src/main/java/com/skyzen/careers/service/ApplicationService.java#L68-L71)). | Apply-time gate only — listing is `permitAll`. |
| JOB_APPLIED | ✅ `APPLIED` | same as APPLICATION_SUBMITTED | ✅ |
| RESUME_RECEIVED | ❌ Not a status; Resume row exists. | — | n/a — uniqueness key prevents duplicate apply. |
| SCREENING_SENT | ✅ | [ApplicationStatus.java:7](backend/src/main/java/com/skyzen/careers/enums/ApplicationStatus.java#L7); also `ScreeningStatus.SENT`. | ✅ legal from APPLIED. |
| SCREENING_COMPLETED | ✅ | [ApplicationStatus.java:8](backend/src/main/java/com/skyzen/careers/enums/ApplicationStatus.java#L8) | ✅ legal from SCREENING_SENT only. |
| INTERVIEW_SCHEDULED | ✅ | [ApplicationStatus.java:10](backend/src/main/java/com/skyzen/careers/enums/ApplicationStatus.java#L10) + InterviewStatus.SCHEDULED. | ✅ Multiple sources legal (APPLIED/SHORTLISTED/SCREENING_COMPLETED). |
| INTERVIEW_COMPLETED | ✅ as `INTERVIEWED` | [ApplicationStatus.java:11](backend/src/main/java/com/skyzen/careers/enums/ApplicationStatus.java#L11) | ✅ |
| SELECTED_CONDITIONAL | ✅ | [ApplicationStatus.java:15](backend/src/main/java/com/skyzen/careers/enums/ApplicationStatus.java#L15) | ✅ via `POST /api/v1/applications/{id}/conditional-select` ([ApplicationService.java:251-290](backend/src/main/java/com/skyzen/careers/service/ApplicationService.java#L251-L290)). |
| OFFER_SENT | ✅ as `OFFERED` + `OfferStatus.SENT` | [ApplicationStatus.java:16](backend/src/main/java/com/skyzen/careers/enums/ApplicationStatus.java#L16); [OfferService.java:216-246](backend/src/main/java/com/skyzen/careers/service/OfferService.java#L216-L246). | ✅ |
| OFFER_ACCEPTED | ✅ as `ACCEPTED` + `OfferStatus.ACCEPTED` | [ApplicationStatus.java:17](backend/src/main/java/com/skyzen/careers/enums/ApplicationStatus.java#L17); [OfferService.java:249-316](backend/src/main/java/com/skyzen/careers/service/OfferService.java#L249-L316). | ✅ |
| I983_REQUIRED | ⚠️ Implicit by `expectedTrack=STEM_OPT` → router seeds I-983 tasks. | [ComplianceRoutingService.java:142-149](backend/src/main/java/com/skyzen/careers/service/ComplianceRoutingService.java#L142-L149). | Implicit. |
| I983_EXECUTED | ⚠️ Partial. `I983Status.COMPLETE` means both sigs; PED's "DSO-ready". | [I983Status.java](backend/src/main/java/com/skyzen/careers/enums/I983Status.java) | I-983 has its own lifecycle DRAFT → COMPLETE → SUBMITTED_TO_DSO → DSO_APPROVED. |
| I9_SECTION1_COMPLETE | ✅ as `I9Status.SECTION_2_PENDING` (Phase-3 rename; legacy `SECTION_1_COMPLETE` kept). | [I9Status.java:18-20](backend/src/main/java/com/skyzen/careers/enums/I9Status.java#L18-L20). | ✅ Set on Section 1 submit. |
| I9_SECTION2_COMPLETE | ✅ as `I9Status.COMPLETED` | [I9Status.java:20](backend/src/main/java/com/skyzen/careers/enums/I9Status.java#L20). | ✅ |
| EVERIFY_CASE_CREATED | ✅ as `EVerifyStatus.OPEN` (was `PENDING_SUBMISSION` → `OPEN`). | [EVerifyStatus.java:4-5](backend/src/main/java/com/skyzen/careers/enums/EVerifyStatus.java#L4-L5). | Service-side. |
| EVERIFY_AUTHORIZED | ✅ as `EVerifyStatus.EMPLOYMENT_AUTHORIZED` | [EVerifyStatus.java:6](backend/src/main/java/com/skyzen/careers/enums/EVerifyStatus.java#L6). | ✅ |
| ONBOARDING_COMPLETE | ✅ as `EngagementStatus.READY_TO_START` (after `markReady`). | [EngagementService.java:152-167](backend/src/main/java/com/skyzen/careers/service/EngagementService.java#L152-L167). | ✅ gated by `ComplianceRoutingService.requirementsSatisfied`. |
| ACTIVE_INTERNSHIP | ✅ as `EngagementStatus.ACTIVE` | [EngagementStatus.java:20-26](backend/src/main/java/com/skyzen/careers/enums/EngagementStatus.java#L20-L26). | ✅ from READY_TO_START only. |
| WEEKLY_REPORT_SUBMITTED | ⚠️ Partial. No `weekly_reports` entity. Timesheet has a `description` field ([Timesheet.java:52-53](backend/src/main/java/com/skyzen/careers/entity/Timesheet.java#L52-L53)) which double-duties as a narrative report. | — | TimesheetStatus.SUBMITTED is the proxy. |
| EVALUATION_COMPLETED | ✅ `EvaluationSessionStatus.COMPLETED` | [EvaluationSession.java](backend/src/main/java/com/skyzen/careers/entity/EvaluationSession.java) | ✅ |
| INTERNSHIP_COMPLETED | ✅ as `EngagementStatus.COMPLETED` | [EngagementLifecycle.java:59-61](backend/src/main/java/com/skyzen/careers/application/EngagementLifecycle.java#L59-L61). | ✅ only from ACTIVE. |

**Verdict:** 18/26 PED codes are *enum statuses*; 8 are *implicit* via foreign keys or sub-entity rows (verification, applicant ID, job postings unlocked, resume, screening sent in funnel, I-983 required, weekly report). The PED's "every state change has timestamp/owner/ip/source" is **partially honored** — owner + timestamp + entityType + action are all on `AuditLog`; `ipAddress` field exists but is **never populated** (`AuditLog.builder()` call sites at [ApplicationService.java:387-396](backend/src/main/java/com/skyzen/careers/service/ApplicationService.java#L387-L396), [OfferService.java:646-657](backend/src/main/java/com/skyzen/careers/service/OfferService.java#L646-L657), etc. all omit the field).

### 2.2 Eight Backend Automation Rules

| # | Rule | Status | Evidence |
|---|---|---|---|
| 1 | No job-posting access until email verified | **Partially enforced** | Apply blocks unverified: [ApplicationService.java:68-71](backend/src/main/java/com/skyzen/careers/service/ApplicationService.java#L68-L71) (throws `EmailUnverifiedException` → 403 `EMAIL_UNVERIFIED`). HOWEVER, the *browse* endpoints `GET /api/v1/job-postings` and `GET /api/v1/job-postings/{idOrSlug}` are `permitAll()` ([SecurityConfig.java](backend/src/main/java/com/skyzen/careers/config/SecurityConfig.java) — listed by audit), so anyone can browse postings without verification. PED says verification *unlocks* postings — current behavior unlocks *applying*, not viewing. |
| 2 | No interview scheduling until application + resume submitted | **Enforced** (by association) | `POST /api/v1/interviews` requires an `applicationId` ([InterviewController.java:40](backend/src/main/java/com/skyzen/careers/controller/InterviewController.java#L40)). Application creation in `ApplicationService.apply` requires a non-null `resumeId` belonging to the candidate ([ApplicationService.java:86-91](backend/src/main/java/com/skyzen/careers/service/ApplicationService.java#L86-L91)). Indirect — no explicit "resume present" guard at the interview-create site. |
| 3 | No offer generation until interview scorecard or ops approval | **NOT enforced** | `OfferService.create` only rejects `TERMINAL_FOR_OFFER` statuses (ACCEPTED/REJECTED/WITHDRAWN/ONBOARDING/ACTIVE/COMPLETED/LAPSED/NO_SHOW) at [OfferService.java:107-110](backend/src/main/java/com/skyzen/careers/service/OfferService.java#L107-L110). A recruiter can create an offer for an application in `APPLIED` or `SHORTLISTED` with **no interview at all**. The `LEGAL_TRANSITIONS` map allows OFFERED from APPLIED/SHORTLISTED ([ApplicationLifecycle.java:87,107](backend/src/main/java/com/skyzen/careers/application/ApplicationLifecycle.java#L87)) deliberately. This is a **compliance posture decision**, not a bug — but it directly violates PED rule 3. |
| 4 | No I-9 / E-Verify before offer acceptance and I-9 completion | **NOT enforced for I-9 row creation** | `I9FormService.getOrCreateForCandidate` ([I9FormService.java:92-97](backend/src/main/java/com/skyzen/careers/service/I9FormService.java#L92-L97)) lazy-creates an I-9 row for *any* candidate id, regardless of offer status. `GET /api/v1/i9/me` is open to any CANDIDATE ([I9Controller.java:34](backend/src/main/java/com/skyzen/careers/controller/I9Controller.java#L34)) and will create + return an empty form even if the candidate never had an offer. Section-1 submit similarly does not check `OfferStatus.ACCEPTED`. EVerifyCase creation is service-side and 1:1-bound to an I-9 — same pre-offer leak. **This is the highest-risk compliance gap** vs PED §8 / E-Verify "not a prescreening tool". |
| 5 | No active-internship access until compliance + onboarding complete | **Enforced** | `EngagementService.markReady` consults `ComplianceRoutingService.missingRequirements` and throws `BadRequestException("Not ready: ...")` if anything is pending ([EngagementService.java:152-167](backend/src/main/java/com/skyzen/careers/service/EngagementService.java#L152-L167); [ComplianceRoutingService.java:178-250](backend/src/main/java/com/skyzen/careers/service/ComplianceRoutingService.java#L178-L250)). `start` requires READY_TO_START via `LEGAL_TRANSITIONS` ([EngagementLifecycle.java:56-58](backend/src/main/java/com/skyzen/careers/application/EngagementLifecycle.java#L56-L58)). |
| 6 | No GitHub repo access until security ack | **NOT enforced — feature missing entirely** | `grep -r GitHub/github` found only Interview/scorecard skill-area text and a job-posting seeder description. There is **no GitHub OAuth integration, no repo-invite endpoint, no security-acknowledgement task or audit**. The PED's `POST /api/github/invite` is unimplemented. Onboarding has `GITLAB_ACCESS` template ([OnboardingService.java:131-139](backend/src/main/java/com/skyzen/careers/service/OnboardingService.java#L131-L139)) — note: "GitLab", not "GitHub" — but it is a checklist item only, not an integration. |
| 7 | Weekly assignments only to active interns with assigned supervisor | **NOT enforced** | `POST /api/v1/supervised/interns/{candidateId}/assignments` ([WorkAssignmentController.java:33](backend/src/main/java/com/skyzen/careers/controller/WorkAssignmentController.java#L33)) accepts an `intern_id` with no `engagement.status=ACTIVE` precondition; `WorkAssignment` requires `assignedBy` but no check that this user is the *engagement's supervisor*. ERM/TECHNICAL_EVALUATOR/ADMIN can create an assignment for any candidate. |
| 8 | Timesheet approval locks weekly completion | **Partial** | `Timesheet.status=APPROVED` is set on `approve` — but there is no separate `weekly_reports` row to "lock" and no explicit downstream re-edit block. Approved timesheets can theoretically be re-submitted via `PUT /api/v1/supervised/timesheets/{id}`; would need a `status != APPROVED` guard in `TimesheetService.update` to be definitive. (Not read in this pass — flagged for follow-up.) |

---

## 3. Data Model Gap (22 PED tables → entities)

| PED table | Status | Mapping | Notes |
|---|---|---|---|
| `users` | ✅ Present | `User` | Additional columns beyond PED: `applicantId`, `emailVerificationCode/SentAt/ExpiresAt`, `active`. ✓ |
| `applicant_profiles` | ✅ Present (merged onto `candidates`) | `Candidate` | PED splits user vs profile; here profile fields live on `Candidate`. |
| `work_authorization_self_attestation` | ⚠️ **Folded onto `Candidate`** (not a separate table). | `Candidate.authorizedToWork`, `sponsorshipNeeded`, `expectedTrack`, `validityDate`. | PED's intent: a versioned attestation. Current: last-write-wins on `Candidate`. **No history.** |
| `job_postings` | ✅ | `JobPosting` | PED specifies `learning_objectives`, `supervisor_id`, `evaluator_id`. Current `JobPosting` has `description/requirements/location/employmentType` but **no `supervisor_id`, `evaluator_id`, `learning_objectives`** explicit columns. |
| `applications` | ✅ | `Application` | + recruiter rating/notes. |
| `documents` | ⚠️ **Partial / missing** | Only `Resume` exists. | PED's unified `documents` table for I-9 supporting docs / I-983 attachments / training materials is absent. I-9 stores doc *metadata* on the form row itself; nothing is uploaded. |
| `screenings` | ✅ | `Screening` (+ `ScreeningQuestion`, `ScreeningAnswer`). | |
| `interviews` | ✅ | `Interview` | Scorecard rolled in. |
| `offers` | ✅ | `Offer` | + lifecycle audit. |
| `i983_records` | ✅ | `I983Plan` | Comprehensive. |
| `i9_records_metadata` | ⚠️ **Schema deviation** | `I9Form` | Stores **full PII** (SSN plaintext, DoB, full address, all document numbers/expiries) — *not* "metadata only" as PED prescribes. PRODUCT.md §10 acknowledges encryption is a Sprint 4 follow-up; comment at [I9Form.java:108-112](backend/src/main/java/com/skyzen/careers/entity/I9Form.java#L108-L112). |
| `everify_cases_metadata` | ✅ | `EVerifyCase` | Metadata-only — case_number, status, dates. |
| `onboarding_tasks` | ✅ | `OnboardingTask` | Per-candidate-per-offer. |
| `weekly_materials` | ❌ **MISSING** | — | No entity, repository, controller, or table. PED Sprint 6 deliverable. |
| `assignments` | ✅ | `WorkAssignment` | |
| `timesheets` | ✅ | `Timesheet` | |
| `weekly_reports` | ❌ **MISSING** | (substituted by `Timesheet.description`) | PED requires "completed tasks, blockers, learning outcomes, next plan" — current free-text description field. |
| `evaluations` | ✅ | `EvaluationSession` | |
| `communications` | ❌ **MISSING** | — | `NotificationStub` logs but does not persist sent emails. PED's "communication_id, template, recipient, sent_at, opened_at, acknowledged_at" durability story is absent. |
| `audit_logs` | ✅ | `AuditLog` | `ipAddress` column unused — see §2.1 / §7. |

**Verdict:** 17/22 present, 3 missing (`weekly_materials`, `weekly_reports`, `communications`), 2 deviations (`documents` reduced to `Resume`; `i9_records_metadata` stores full PII).

---

## 4. API Gap (PED representative endpoints → actual)

| PED endpoint | Actual | Auth? | Status |
|---|---|---|---|
| `POST /api/auth/register` | `POST /auth/register` (no `/api/v1`) | permitAll | ✅ |
| `POST /api/auth/verify-email` | `POST /auth/verify-email` | permitAll | ✅ |
| `GET/POST /api/jobs` | `GET /api/v1/job-postings` (open), `POST /api/v1/job-postings` (ADMIN/ERM) | mixed | ✅ |
| `POST /api/applications` | `POST /api/v1/applications` | CANDIDATE | ✅ |
| `POST /api/documents/resume` | `POST /api/v1/resumes` | CANDIDATE | ✅ |
| `POST /api/screenings/{id}/submit` | `POST /api/v1/screening/{id}/submit` | CANDIDATE | ✅ |
| `GET /api/interviews/slots` | ❌ **Missing.** | n/a | Calendar slot-selection (candidate self-schedules) NOT implemented; ERM schedules directly. |
| `POST /api/interviews/{id}/scorecard` | `POST /api/v1/interviews/{id}/scorecard` ([InterviewController.java:106-109](backend/src/main/java/com/skyzen/careers/controller/InterviewController.java#L106-L109)) | TECHNICAL_EVALUATOR/ERM/ADMIN | ✅ |
| `POST /api/offers/{id}/accept` | `POST /api/v1/offers/{id}/accept` | CANDIDATE | ✅ |
| `GET/POST /api/compliance/i983/{id}` | `PATCH /api/v1/i983/{id}` + sign-employer/sign-student/submit-to-dso/dso-response | ERM/HR_COMPLIANCE/ADMIN | ✅ |
| `GET/POST /api/onboarding/tasks` | `GET /api/v1/onboarding/me`, `PATCH /api/v1/onboarding/tasks/{taskId}` | CANDIDATE/HR/ERM/ADMIN | ✅ |
| `POST /api/github/invite` | ❌ **Missing.** | n/a | No GitHub integration. |
| `GET/POST /api/weekly-materials` | ❌ **Missing.** | n/a | Entity + controller absent. |
| `POST /api/assignments/{id}/submit` | `POST /api/v1/supervised/assignments/{id}/submit` | CANDIDATE | ✅ |
| `GET/POST /api/timesheets/{week}` | `POST /api/v1/supervised/my/timesheets`, `GET /api/v1/supervised/my/timesheets` | CANDIDATE | ✅ |
| `GET/POST /api/evaluations` | `POST /api/v1/supervised/interns/{candidateId}/evaluations`, `POST /api/v1/supervised/evaluations/{id}/complete` | EVALUATOR/ERM/ADMIN | ✅ |
| `GET /api/admin/reports/pipeline` | `GET /api/v1/admin/overview` ([AdminInsightsController.java:30](backend/src/main/java/com/skyzen/careers/controller/AdminInsightsController.java#L30)) | ADMIN | ✅ (partial — single overview) |

**Auth coverage:** every endpoint *except* the two file downloads has `@PreAuthorize` at method or class level (see §5). All write DTOs carry `@Valid` (controller audit). **Auth prefix mismatch:** `auth/*` lives at root, app endpoints at `/api/v1/*` — intentional per PRODUCT.md §7 but worth calling out — frontend clients must hardcode two prefixes.

---

## 5. RBAC & Auth Audit

### 5.1 Roles
6 defined in [UserRole.java](backend/src/main/java/com/skyzen/careers/enums/UserRole.java): `CANDIDATE`, `RECRUITER`, `ERM`, `HR_COMPLIANCE`, `TECHNICAL_EVALUATOR`, `ADMIN`. ✅ Matches PED.

### 5.2 JWT wiring
- [JwtAuthenticationFilter.java](backend/src/main/java/com/skyzen/careers/auth/JwtAuthenticationFilter.java) + [JwtUtil.java](backend/src/main/java/com/skyzen/careers/auth/JwtUtil.java) + `CustomUserDetailsService` + `SecurityConfig` — end-to-end wired. Login at `/auth/login` returns JWT; subsequent calls verify the Bearer token.
- `User.active=false` blocks login at [AuthService.java:228-231](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L228-L231) (returns 401, not 403, to avoid existence oracle).

### 5.3 `@PreAuthorize` coverage
The controller inventory (sub-agent) confirms every endpoint has `@PreAuthorize` **except**:
- **`GET /health`** ([HealthController.java](backend/src/main/java/com/skyzen/careers/controller/HealthController.java)) — intentional public diagnostic.
- **`GET /api/v1/job-postings`** + **`GET /api/v1/job-postings/{idOrSlug}`** — intentional public browse (`SecurityConfig.permitAll`).
- **`GET /api/v1/resumes/{id}/download`** ([ResumeController.java:48](backend/src/main/java/com/skyzen/careers/controller/ResumeController.java#L48)) — **no `@PreAuthorize`**; relies on a runtime null-check on `@AuthenticationPrincipal User user`. Authorization logic is buried in `ensureCanDownload` ([ResumeController.java:54](backend/src/main/java/com/skyzen/careers/controller/ResumeController.java#L54)). PRODUCT.md §6 mandates "explicit `@PreAuthorize` on every endpoint" — this is a guideline violation.
- **`GET /api/v1/offers/{id}/download`** ([OfferController.java:137](backend/src/main/java/com/skyzen/careers/controller/OfferController.java#L137)) — same pattern; same violation.

### 5.4 Unprotected sensitive endpoints
**None of the actually-sensitive endpoints (offers, compliance, audit, admin) are open.** All `/api/v1/admin/*`, `/api/v1/compliance/*`, `/api/v1/i9/*`, `/api/v1/i983/*`, `/api/v1/everify/*`, `/api/v1/engagements/*` have role gates. The two resume/offer download endpoints are the only "soft" cases — authorization is enforced inside the handler, but not declaratively.

---

## 6. Compliance-Gate Correctness

| Required behavior | Implementation | Verdict |
|---|---|---|
| I-9 Section 1+2 only after offer acceptance | **VIOLATED.** `I9FormService.getOrCreateForCandidate` ([I9FormService.java:92-97](backend/src/main/java/com/skyzen/careers/service/I9FormService.java#L92-L97)) lazy-creates an I-9 for any candidate regardless of offer status. `saveSection1` ([I9FormService.java:181-234](backend/src/main/java/com/skyzen/careers/service/I9FormService.java#L181-L234)) does not check for `OfferStatus.ACCEPTED`. A `CANDIDATE` could navigate to `/careers/candidate/i9`, submit Section 1, and seed deeply-PII data with no offer. | **BUG / compliance risk** |
| E-Verify only after I-9 complete and offer accepted | **PARTIAL.** `EVerifyCase` is 1:1 with `I9Form` (`uk_everify_i9_form` unique constraint), and creation is restricted to HR. However, since I-9 creation isn't offer-gated, the chain inherits the leak. | **BUG / compliance risk** |
| I-983 surfaces only for STEM OPT track | **PARTIAL — frontend-only.** `AuthService.me` ([AuthService.java:279-283](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L279-L283)) returns `expectedTrack` so the candidate sidebar can hide the I-983 tile when track ≠ STEM_OPT. Backend `I983Controller` enforces no track gate; `GET /api/v1/i983/me` returns plans for any candidate role. Plan creation is ERM-only. | Acceptable for staff; **frontend-only hiding for candidates** (no defense in depth). |
| No document collection pre-offer | The `documents` entity does not exist; resumes only. Resume upload is pre-offer (correctly, since resume is *not* a compliance doc). ✅ But `I9Form` row creation pre-offer (above) effectively *is* premature document collection. | **BUG via I-9 leak** |

**Top compliance bug to fix first:** gate `I9FormService.getOrCreateForCandidate` and `saveSection1` on at least one accepted offer / non-blocked engagement.

---

## 7. Audit Logging

### 7.1 Coverage map

| Action | Auditable? | Audited? | Where |
|---|---|---|---|
| Registration | ✅ | ✅ `EMAIL_VERIFICATION_PENDING` | [AuthService.java:99](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L99) |
| Email verified | ✅ | ✅ `EMAIL_VERIFIED` + `APPLICANT_ID_CREATED` | [AuthService.java:138-156](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L138-L156) |
| Login | ✅ | ❌ **Not audited.** | Only `log.info` at [AuthService.java:232](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L232). Failed logins also only logged. |
| Logout | ✅ | ❌ **No endpoint at all.** | (JWT is stateless; should still emit a logout audit row for forensics.) |
| Password reset request / completion | ✅ | ❌ **Not audited.** Token logged in plaintext at [AuthService.java:248](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L248). | **Security smell.** |
| Apply to posting | ✅ | ⚠️ Indirect — first STATUS audit fires on next transition. | `Application` creation itself writes no audit row. |
| Application status change | ✅ | ✅ `STATUS_CHANGE` / `SHORTLIST` / `REJECT` / `CONDITIONAL_SELECT` | [ApplicationService.java:381-396](backend/src/main/java/com/skyzen/careers/service/ApplicationService.java#L381-L396) |
| Interview schedule/update/feedback | ✅ | ✅ (per `Grep` for `AuditLog.builder` in `InterviewService.java`) | Confirmed in service-write inventory. |
| Offer create/update/send/accept/decline/revoke/delete/expire | ✅ | ✅ all 8 actions | [OfferService.java:145-373,503](backend/src/main/java/com/skyzen/careers/service/OfferService.java) |
| Engagement create / mark-ready / start / status transitions | ✅ | ✅ | [EngagementService.java:122-140,261-264](backend/src/main/java/com/skyzen/careers/service/EngagementService.java) |
| Onboarding task create / status change | ✅ | ✅ | [OnboardingService.java:283-285](backend/src/main/java/com/skyzen/careers/service/OnboardingService.java) (per Grep) |
| I-9 Section 1 / 2 / reopen | ✅ | ✅ `SECTION_1_SUBMIT` etc. | [I9FormService.java:230-232,320-322,381-382](backend/src/main/java/com/skyzen/careers/service/I9FormService.java) |
| I-983 mutations | ✅ | ✅ | (per Grep in `I983Service.java`) |
| E-Verify mutations | ✅ | ✅ | (per Grep in `EVerifyService.java`) |
| Screening sent / submitted | ✅ | ✅ | (per Grep in `ScreeningService.java`) |
| Resume upload / download / delete | ✅ | ❌ **Not audited.** | Resume upload + delete should write audits — they don't. Downloads (PII-bearing) should also audit. |
| Candidate profile updates (`PUT /api/v1/users/me`) | ✅ | ⚠️ Not verified — `UserProfileService` not deeply read this pass. Likely missing. | Follow-up. |
| Acknowledgements (policy, GitHub, hierarchy) | ✅ | ❌ **Feature missing entirely.** | No ack model. |
| Emails sent | ✅ | ❌ **Not durable.** | `NotificationStub` logs only; no `communications` table; not in audit log either. |

### 7.2 Schema gap
`AuditLog.ipAddress` ([AuditLog.java:39](backend/src/main/java/com/skyzen/careers/entity/AuditLog.java#L39)) — **column exists, never written.** No `AuditLog.builder().ipAddress(...)` call anywhere in `service/`. PED §5 + §13 require IP/UA "when applicable"; this is not currently captured. Source-module field (PED) is also absent — only `entityType + action` are stored.

---

## 8. Backend Logic Quality (concrete file:line)

1. **`DocumentService.listAll` — classic N+1.** Iterates `i9FormRepository.findAll()`, `i983PlanRepository.findAll()`, `offerRepository.findAll()`, `resumeRepository.findAll()` and dereferences `candidate.user / application.candidate.user / jobPosting.entity` lazily inside the loop. Will scale-fail on a populated tenant.
   - [DocumentService.java:73-87](backend/src/main/java/com/skyzen/careers/service/DocumentService.java#L73-L87) (loops) + the `mapI9 / mapI983 / mapOffer / mapResume` methods at lines 155-240. Fix: use the existing fetch-graph variants (e.g. `findAllWithGraph` like `I9FormRepository` already exposes).

2. **`ComplianceOverviewService.getOverview` — N+1.** Loads all I-9 / I-983 / E-Verify / Offer rows and walks lazy `candidate.user` and `jobPosting.entity` chains.
   - [ComplianceOverviewService.java:61-79](backend/src/main/java/com/skyzen/careers/service/ComplianceOverviewService.java#L61-L79). Same fix.

3. **`AuthService.forgotPassword` logs the reset token in plaintext.**
   - [AuthService.java:248](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L248) — `log.info("DEV ONLY — password reset token for {}: {}", req.email(), token);`. Even with "DEV ONLY" prefix, this ships to whatever log sink Railway has and is a real token until used/expired. Sprint-5 hardening item.

4. **`OfferService.acceptInternal` — three sequential best-effort side effects.**
   - [OfferService.java:285-314](backend/src/main/java/com/skyzen/careers/service/OfferService.java#L285-L314). If `engagementService.createForAcceptedOffer` fails, `onboardingService.seedTasksForAcceptedOffer` proceeds anyway with `engagement=null`. If the onboarding seed fails, compliance routing still runs with the same engagement. Each failure is `log.warn`'d but the candidate ends up in a half-built state (offer accepted, engagement missing, onboarding tasks missing). No retry queue, no admin "repair" endpoint surfaced. The intent is "never block acceptance" — fine — but operational visibility on partial failures is poor.

5. **`OfferService.create` accepts offers from `APPLIED`/`SHORTLISTED`.**
   - [OfferService.java:69-110](backend/src/main/java/com/skyzen/careers/service/OfferService.java#L69-L110). `TERMINAL_FOR_OFFER` blocks only post-offer / exit states; pre-interview offers are accepted. Violates PED rule 3 (see §2.2). Either widen the terminal set to include states before INTERVIEWED, or require interview scorecard / explicit override.

6. **`I9FormService.getOrCreateForCandidate` creates compliance row pre-offer.**
   - [I9FormService.java:92-144](backend/src/main/java/com/skyzen/careers/service/I9FormService.java#L92-L144). Should be gated on accepted offer / non-blocked engagement, with a clear "post-offer only" 403 when not yet allowed.

7. **`AuditLog.ipAddress` never populated.**
   - All `AuditLog.builder()` sites (10 service files) omit the field — `ApplicationService.java:387-396`, `OfferService.java:646-657`, `I9FormService.java`'s `writeAudit`, etc. The audit story is incomplete for forensic / compliance review.

8. **Native DDL in `SchemaFixupRunner` — safe but un-versioned.**
   - [SchemaFixupRunner.java](backend/src/main/java/com/skyzen/careers/bootstrap/SchemaFixupRunner.java). All `IF EXISTS / IF NOT EXISTS` guarded — idempotent and safe. But there is no formal migration framework (Flyway/Liquibase). Every new enum value or column add lives here as raw `JdbcTemplate.execute`. Will become unmanageable; flagged for Sprint 5/8.

9. **`Application.resume` is `@ManyToOne(fetch = LAZY)` with no `nullable=false` constraint** ([Application.java:37-39](backend/src/main/java/com/skyzen/careers/entity/Application.java#L37-L39)). At-create the service enforces `resumeId` non-null, but the column allows NULL — `ALTER TABLE applications ALTER COLUMN resume_id SET NOT NULL` is not enforced. Defensive only; not a known bug.

10. **`Timesheet` doubles as `weekly_report`.** [Timesheet.java:52-53](backend/src/main/java/com/skyzen/careers/entity/Timesheet.java#L52-L53) has a free-text `description`. Two PED entities collapsed into one — works for v1 but loses the structured PED fields (`completed_work`, `blockers`, `next_plan`).

11. **`NotificationStub` is the only "email" surface.** [NotificationStub.java](backend/src/main/java/com/skyzen/careers/notification/NotificationStub.java). Three methods: `sendVerificationCode`, `sendApplicantIdIssued`, `sendConditionalSelectionConfirmation`. All other PED-listed notifications (welcome, hierarchy intro, GitHub invite, supervisor intro, weekly material released, assignment released, timesheet/report reminder, evaluation reminder) are **unimplemented entry points**, not stubs.

12. **`AuthService.forgotPassword` returns always-success but does NOT emit an audit row** — should emit `PASSWORD_RESET_REQUESTED` regardless of whether the email exists (privacy-preserving, just don't include email-existence boolean in the row).

13. **Returning entities vs DTOs — clean.** Sub-agent confirmed: no controller returns `Entity` directly; all use response DTOs.

14. **`PageImpl` leak — clean.** Services occasionally return `Page` but controllers wrap with `PagedResponse.of(...)` before returning.

15. **`SeedJobPostingsRunner` / `SeedDemoDataExecutor`** run unconditionally — should be `@Profile("!prod")` to avoid demo postings appearing in production tenants.

---

## 9. Rebrand Residue (Anvi)

`grep -ri Anvi a:\Websites\skyzentech.com\backend` → **no matches.**
`grep -ri Anvi a:\Websites\skyzentech.com\frontend` → **no matches.**
Only file containing "Anvi" anywhere in repo: `.pedroadmap.txt` (this audit's PDF-to-text dump of the PED, which still uses the original "Anvi" branding — that's expected and not a code residue).

**PED → product name mapping already complete:** the PED's `ANVI_ID_CREATED` status is implemented as `APPLICANT_ID_CREATED` ([AuthService.java:155](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L155)); applicant IDs are `SKZ-INT-YYYY-NNNNNN` (sequence: `skyzen_applicant_seq` — [SchemaFixupRunner.java:91](backend/src/main/java/com/skyzen/careers/bootstrap/SchemaFixupRunner.java#L91)).

✅ **Rebrand is clean.** No Anvi residue in shipped code, config, or copy.

---

## 10. Prioritized Fix List

Grouped per the user's ordering: (a) broken gates/compliance bugs → (b) missing core state machine → (c) data model gaps → (d) API/RBAC gaps → (e) logic-quality cleanup → (f) rebrand. Each row: PED Sprint slot + effort.

### (a) Broken gates / compliance bugs

| # | Fix | Sprint | Effort |
|---|---|---|---|
| A1 | **Gate I-9 row creation on accepted offer.** Block `I9FormService.getOrCreateForCandidate` + `saveSection1` until the candidate has at least one `OfferStatus.ACCEPTED` offer OR a non-blocked `Engagement`. Return 403 with code `OFFER_REQUIRED` pre-offer. | 4 (Offer + compliance gate) | M |
| A2 | **Gate E-Verify creation chain.** Once A1 lands, the I-9 dependency naturally gates E-Verify, but also add an explicit check in `EVerifyService.create`: linked `I9Form.status=COMPLETED` AND engagement not in `BLOCKED_NO_AUTHORIZATION`. | 4 | S |
| A3 | **Require interview decision before offer.** Tighten `OfferService.create` to refuse creation when `application.status` ∉ {`INTERVIEWED`, `SELECTED_CONDITIONAL`, `OFFERED`} (the last for re-issue). Add an explicit ADMIN/HR override path so emergency offers still work. | 4 | M |
| A4 | **Honor "job postings unlocked on email verify".** Either flip `GET /api/v1/job-postings` to authenticated + emailVerified=true, OR strip non-verified candidates' ability to see "Apply" CTAs server-side. Current public browse contradicts PED §5. | 1 (foundation) | S |
| A5 | **I-983 server-side track gate.** Add a server check in `I983Service` to ensure the candidate's snapshot `Engagement.track == STEM_OPT` (not just frontend hiding) before listing/creating plans on behalf of a candidate. | 4 | S |
| A6 | **Resume/offer download `@PreAuthorize`.** Add explicit method-level `@PreAuthorize` to [ResumeController.java:48](backend/src/main/java/com/skyzen/careers/controller/ResumeController.java#L48) + [OfferController.java:137](backend/src/main/java/com/skyzen/careers/controller/OfferController.java#L137). PRODUCT.md §6 guardrail violation. | 5 (HARDEN) | S |

### (b) Missing core state machine

| # | Fix | Sprint | Effort |
|---|---|---|---|
| B1 | **Application creation audit row.** `ApplicationService.apply` should write an `APPLICATION_SUBMITTED` audit so the funnel has a starting timestamp from day one. | 1/2 | S |
| B2 | **Audit log IP capture.** Plumb `HttpServletRequest` → `AuditLog.ipAddress` via a `RequestContextHolder`-based helper or a thread-local. Touch all 10 service write sites. PED requires this. | 5 | M |
| B3 | **Audit log "source module" field.** PED specifies an explicit `source` (recruiter screen, candidate flow, system). Add an enum + populate on every write. | 5 | M |
| B4 | **Login / logout / password-reset audit rows.** Add `LOGIN_SUCCESS`, `LOGIN_FAILED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED` rows in `AuthService`. | 5 | S |
| B5 | **Lock approved timesheets.** Add `status != APPROVED` guard in `TimesheetService.update`/`submit`. PED rule 8. | 6 | S |
| B6 | **Engagement supervisor gate on assignment creation.** Validate in `WorkAssignmentService.create` that `engagement.status == ACTIVE` and `assignedBy.id == engagement.supervisor.id` (or the caller has elevated role). PED rule 7. | 6 | M |

### (c) Data model gaps

| # | Fix | Sprint | Effort |
|---|---|---|---|
| C1 | **`weekly_materials` entity + repo + controller.** PED Sprint 6 deliverable. CRUD by supervisor; intern view; release date + acknowledgment. | 6 | M |
| C2 | **`weekly_reports` entity.** Split structured report from `Timesheet.description` (completed_work / blockers / learning_outcomes / next_plan). | 6 | M |
| C3 | **`communications` entity + send pipeline.** Replace `NotificationStub` with a real `CommunicationsService` that persists `template / recipient / sent_at / opened_at / acknowledged_at`. Wire to a real provider (Resend / SES) in Sprint 4. | 4 | L |
| C4 | **`documents` entity for post-offer compliance attachments.** Distinct from `Resume`. Owner, type (`I9_LIST_A`/`I9_LIST_B`/`I9_LIST_C`/`I983_ATTACHMENT`/etc.), storage_key, access_level. Underpins remote-I-9 retention. | 4 | L |
| C5 | **Work-auth attestation history.** Store snapshots in a child table when a candidate updates `expectedTrack` / `authorizedToWork` / `sponsorshipNeeded` — PED treats this as an attestation log, not a mutable column. | 4 | M |
| C6 | **`JobPosting` fields.** Add `supervisorId`, `evaluatorId`, `learningObjectives`, `hoursPerWeek`, `workModel` columns — PED §10. | 2/3 | S |
| C7 | **I-9 PII encryption at rest.** Encrypt `ssn`, `alienRegistrationNumber`, document numbers using KMS/Postgres pgcrypto. PRODUCT.md §11 already plans R2+KMS in Sprint 4. | 4 | L |

### (d) API / RBAC gaps

| # | Fix | Sprint | Effort |
|---|---|---|---|
| D1 | **`GET /api/interviews/slots` (candidate self-schedule).** PED step 7 — currently ERM schedules directly; candidate picks no slot. | 3 | M |
| D2 | **`POST /api/github/invite` + GitHub OAuth integration.** PED rule 6 / step 13 / endpoint list. | 6 | L |
| D3 | **Security acknowledgement task + gate.** Block `POST /api/github/invite` until an `OnboardingTask(taskKey=SECURITY_ACK)` is COMPLETED. | 6 | S |
| D4 | **`GET/POST /api/weekly-materials`.** Pairs with C1. | 6 | M |
| D5 | **`GET /api/admin/reports/pipeline` — funnel metrics.** Current `/api/v1/admin/overview` returns counts; extend with stage-transition timing, drop-off, source-of-hire. | 7 | M |
| D6 | **Auth path consistency.** Either move `/auth/*` under `/api/v1/auth/*` or keep — but document for SDK consumers. Sprint 5 cleanup. | 5 | S |

### (e) Logic-quality cleanup

| # | Fix | Sprint | Effort |
|---|---|---|---|
| E1 | **Fix N+1 in `DocumentService.listAll`** ([DocumentService.java:73-87](backend/src/main/java/com/skyzen/careers/service/DocumentService.java#L73-L87)). Use `findAllWithGraph` variants. | 5 | S |
| E2 | **Fix N+1 in `ComplianceOverviewService.getOverview`** ([ComplianceOverviewService.java:61-79](backend/src/main/java/com/skyzen/careers/service/ComplianceOverviewService.java#L61-L79)). Same fix. | 5 | S |
| E3 | **Stop logging password-reset tokens.** [AuthService.java:248](backend/src/main/java/com/skyzen/careers/auth/AuthService.java#L248) — remove the dev log or gate via `app.notification.surface-stub`. | 5 | S |
| E4 | **Move bootstrap seeders behind `@Profile("!prod")`.** `SeedJobPostingsRunner`, `SeedDemoDataRunner`, `RoleTestUsersSeeder` should not run in production. | 5 | S |
| E5 | **Introduce Flyway / Liquibase.** Migrate `SchemaFixupRunner` DDL into versioned migrations. | 8 | L |
| E6 | **Resume upload/download/delete audit rows.** Sensitive PII events deserve audit trail. | 5 | S |
| E7 | **Tighten `Application.resume_id` NOT NULL.** Add `nullable = false` on the join column once existing data is verified clean. | 5 | XS |
| E8 | **Acceptance partial-failure recovery.** `OfferService.acceptInternal` swallows engagement/onboarding/routing failures. Surface a "compliance backfill" admin endpoint to repair partial accepts. | 5 | M |
| E9 | **OfferLetterTemplate → real PDF.** Currently TXT body. PRODUCT.md §11 acknowledges. | 4 | M |

### (f) Rebrand

| # | Fix | Sprint | Effort |
|---|---|---|---|
| F1 | None — rebrand is clean. ✅ | — | — |

---

## Sprint-Plan Mapping (which sprint is the code in?)

Per the PED's 8-sprint plan, **the code is currently between Sprint 5 and Sprint 6**:

- **Sprint 1 (Foundation + applicant auth):** ✅ Complete — registration, verification, Applicant ID, audit log.
- **Sprint 2 (Job postings + applications):** ✅ Complete — postings, apply, status pipeline.
- **Sprint 3 (Screening + interviews):** ✅ Complete (no candidate self-schedule slots — D1 outstanding).
- **Sprint 4 (Offer + compliance gate):** ⚠️ **80%** — offers work, I-9/I-983/E-Verify entities present, BUT compliance gate ordering is broken (A1-A3). No real PDF, no real email, no encryption-at-rest. Strictly Sprint 4 is **incomplete on the COMPLIANCE side**.
- **Sprint 5 (Onboarding + role dashboards):** ✅ Mostly done. Onboarding checklist, supervisor/evaluator assignment, all role dashboards exist. Quality gaps in §8 (E1-E8) belong here.
- **Sprint 6 (Weekly training + project delivery):** ❌ **MOSTLY MISSING** — weekly_materials / weekly_reports / GitHub integration absent. WorkAssignment + Timesheet exist as raw building blocks.
- **Sprint 7 (Evaluations + ops reports):** ⚠️ Partial — `EvaluationSession` exists, evaluator dashboards exist; advanced reporting (funnel/drop-off) doesn't.
- **Sprint 8 (Hardening + compliance review):** ❌ Not started — no MFA, no Flyway, no retention policies, no formal accessibility QA.

**Net:** the codebase claims to be ATS-complete with compliance-vault scaffolding, but **compliance ordering is the active bug** and **Sprint 6 (weekly cycle) is essentially un-built** beyond the storage layer. The order to attack: A1→A3 (gate compliance) → C1/C2/C3 (Sprint 6 entities) → D2 (GitHub) → E1/E2 (N+1) → C7 (encryption).

---

**Audit complete, no files modified.**
