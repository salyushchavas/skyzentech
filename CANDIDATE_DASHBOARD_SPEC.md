# CANDIDATE_DASHBOARD_SPEC.md — Skyzen Careers

> Design spec for the **Candidate / Intern** dashboard (one of the six role dashboards).
> Companion to `PRODUCT.md`, `EXECUTION_PLAN.md`, and the roles audit. Folds into the
> CANDIDATE-role refinement. The other five role dashboards are specced separately.

---

## 1. Concept — one shell, two faces

The candidate and the intern are the **same person at two lifecycle stages**, so this is
**one dashboard that adapts**, not two builds:

- **Applicant face** (Phase 1, before hire) — getting through the hiring pipeline.
- **Intern face** (Phase 2, after the engagement goes ACTIVE) — the weekly cycle.

Same layout and components; the content and data source switch automatically when the
candidate's engagement becomes ACTIVE. Build the shell once.

---

## 2. Layout (top → bottom)

1. **Header** — greeting, applicant/intern ID, current-stage pill, notification bell.
2. **Journey bar** — six macro steps, always visible; the current step expands.
3. **"Your next step" hero** — the single next action, or a clear waiting state.
4. **Status cards** (3-up) — context-dependent (applicant vs intern).
5. **Upcoming** (agenda) + **Recent activity** (feed) — two columns.
6. **Quick links** — the few things they touch often (context-dependent).

---

## 3. Journey bar (the core idea)

**Two altitudes, progressive disclosure.** The top bar is for orientation; the detail
lives under the step you're actually in.

- The bar shows **six macro steps**, always visible. Only the **current** step is
  expanded into its sub-checklist; past steps collapse to a green check, future steps
  stay collapsed/locked.
- **Never promote sub-steps (I-983, I-9, E-Verify) to top-level** — that balloons the bar
  and loses the clean overview.
- Step states: done (green check), current (blue, ringed), upcoming (muted outline).

**Pre-hire bar (applicant):** Applied → Screening → Interview → Offer → Onboarding → Hired
**Post-hire bar (intern):** swaps to the internship lifecycle —
Setup → Active weeks (shows current week) → Evaluation → Completed

---

## 4. Sub-journeys per macro step (with conditional rules)

Each macro step expands to a checklist of sub-steps, each with its own status. The
compliance step is the dense one and is **conditional on the candidate's work-auth track**
(your backend already routes this — reuse `ComplianceRoutingService`, don't rebuild).

**Onboarding & compliance — sub-steps by track:**

| Track | Sub-steps shown |
|---|---|
| US citizen / PR / other authorized | Offer accepted → I-9 §1 → I-9 §2 (employer) → E-Verify (if enrolled) → onboarding tasks |
| F-1 CPT | Offer accepted → confirm DSO-authorized CPT on I-20 → I-9 §1 → I-9 §2 → onboarding tasks |
| F-1 OPT | Offer accepted → EAD validity check → I-9 §1 → I-9 §2 → E-Verify → onboarding tasks |
| F-1 STEM OPT | Offer accepted → **I-983 training plan** → I-9 §1 → I-9 §2 → E-Verify → onboarding tasks |
| No authorization | Blocked state — "Pending work-authorization review" (no productive-work steps) |

Onboarding tasks bundle = policy acknowledgments, GitHub security ack + access, supervisor intro.

**Phase 2 sub-journeys (intern):**
- **Setup:** welcome → company hierarchy → GitHub access (after security ack) → meet supervisor/evaluator
- **Active week (repeats):** material → assignment → submission (GitHub) → weekly report → timesheet → review
- **Evaluation:** checkpoint technical evaluations
- **Completed:** final record stored

---

## 5. "Your next step" hero — logic

- Resolves the **single next sub-step that is the user's own responsibility** and shows it
  as one clear card with one primary action.
- When the next move belongs to **someone else** (recruiter scheduling, employer doing I-9
  §2, supervisor reviewing), show a **waiting state** instead of a dead end:
  *"We're reviewing your interview — expect to hear by Jun 2."* The person is never left
  guessing.
- **Empty / transition states** handled explicitly: just applied (awaiting screening),
  just hired (welcome), internship complete (congratulations + completion record).

---

## 6. Status cards (context-dependent)

- **Applicant:** Application status · Profile completeness (with bar) · Resume.
- **Intern:** This week's material · Assignment due · Report + timesheet status. Plus a
  **compliance strip**: "I-9 complete · E-Verify cleared · authorized through {date}".

---

## 7. Upcoming + Recent activity

- **Upcoming (agenda):** interviews, then (intern) report/timesheet due dates, evaluation
  checkpoints, and work-authorization expiry reminders.
- **Recent activity (feed):** status changes, emails sent, feedback received — sourced
  from `audit_logs` (filtered to this user) and the `communications` table (once C3 lands).

---

## 8. Data sources (so it's buildable)

Most of this already exists — the new work is mainly a resolver that assembles it.

- **Journey + sub-step states:** application status, offer status, engagement status, and
  `ComplianceRoutingService.missingRequirements` (this already computes exactly the
  compliance sub-checklist state — it's the data behind step 4).
- **Next step + waiting states:** derived from the same status set + whose turn it is.
- **Upcoming:** interviews, timesheet/report due dates, evaluation dates.
- **Activity:** `audit_logs` for this user + `communications`.
- **Compliance strip:** I-9 status, E-Verify status, authorization expiry date.

---

## 9. Visual language

Match the existing app theme. Journey states: done = success, current = info, upcoming =
muted outline. The next-step hero is the one accented element (2px info border). Consistent
status pills. Flat, clean, generous whitespace — no clutter. Notification bell with unread
count in the header.

---

## 10. Reuse vs build-new

- **Reuse (exists):** application/offer/engagement status, compliance routing, interviews,
  timesheets, evaluations, audit log.
- **Build-new:** the journey-bar component (macro steps + expandable sub-checklist), the
  conditional sub-step rendering (per track), the next-step/waiting-state **resolver**, and
  the agenda + activity feeds. The resolver can live backend-side (a single
  `/api/v1/candidate/dashboard` summary endpoint) or be assembled client-side from the
  existing status endpoints — backend summary endpoint preferred (fewer round-trips, one
  source of truth for "what's next").

---

## 11. Acceptance criteria

- Six-step bar always visible; only the current step is expanded.
- Sub-steps render conditionally by the candidate's work-auth track (STEM OPT sees I-983;
  CPT/citizen do not).
- The "next step" hero shows exactly one user-owned action, or a clear waiting state when
  it's someone else's turn — never blank, never a dead end.
- Dashboard switches from applicant face to intern face automatically when the engagement
  becomes ACTIVE.
- Intern face shows the weekly cycle and a compliance/authorization strip.
- Upcoming and Recent activity populate from real data.
- Works in light and dark mode; responsive; accessible.
