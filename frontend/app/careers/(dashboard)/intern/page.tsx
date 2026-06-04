'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Bell,
  BookOpen,
  Briefcase,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSignature,
  FileText,
  ShieldCheck,
  Sparkles,
  Star,
  UserCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { formatRelative, formatDueDate } from '@/lib/format-date';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import JourneyBar from '@/components/dashboard/JourneyBar';
import YourJourneyPanel from '@/components/candidate/YourJourneyPanel';
import DSPageHeader from '@/components/ui/PageHeader';
import type {
  CandidateJourney,
  CandidateResumeInfo,
  Uuid,
} from '@/types';

/**
 * SPEC §1 — Candidate / Intern dashboard. APPLICANT face (Phase 1).
 *
 * One shell, two faces: this file is the applicant face. The intern face
 * reuses {@link JourneyBar} + the same layout with a different stages payload
 * once the engagement goes ACTIVE; that swap is a separate build.
 *
 * Backed by GET /api/v1/candidate/dashboard.
 */

interface NextStep {
  type: string;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  isWaiting?: boolean;
  waitingFor?: string | null;
  expectedBy?: string | null;
}

interface ApplicationSummary {
  id: Uuid;
  position: string | null;
  entityName: string | null;
  status: string | null;
}

interface UpcomingItem {
  type: string;
  title: string | null;
  subtitle: string | null;
  at: string | null;
}

interface ActivityItem {
  text: string | null;
  at: string | null;
}

interface EngagementSummary {
  applicationId?: Uuid | null;
  status?: string | null;
  finalStageLabel?: string | null;
  finalStageState?: string | null;
  onboardingTotal?: number;
  onboardingCompleted?: number;
}

interface ComplianceItem {
  kind: string;
  label: string;
  state: string;
  subtitle?: string | null;
  href?: string | null;
  completedAt?: string | null;
}

// ── Phase-2 intern cockpit ──────────────────────────────────────────────────

interface MaterialCard {
  id: Uuid;
  weekNo: number | null;
  title: string;
  releaseDate: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  href: string;
}

interface ReportCard {
  id: Uuid | null;
  weekStart: string;
  status: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  href: string;
}

interface TimesheetCard {
  id: Uuid | null;
  weekStart: string;
  status: string | null;
  hours: number | string | null;
  href: string;
}

interface AuthorizationInfo {
  expirationDate: string | null;
  daysUntilExpiry: number | null;
  authType: string;
}

interface ProjectCard {
  id: Uuid;
  title: string;
  status: string;
  dueDate: string | null;
  progressPct: number | null;
  reviewNotes: string | null;
  href: string;
}

interface EvaluationCard {
  id: Uuid;
  type: string | null;
  status: string | null;
  overallRating: number | null;
  finalizedAt: string | null;
  selfReviewPending: boolean;
  href: string;
}

interface WeeklyCockpit {
  weekStart: string;
  material: MaterialCard | null;
  report: ReportCard | null;
  timesheet: TimesheetCard | null;
  authorization: AuthorizationInfo | null;
  project: ProjectCard | null;
  latestEvaluation: EvaluationCard | null;
}

interface CandidateDashboardResponse {
  candidateName: string | null;
  profileComplete: number;
  nextStep: NextStep | null;
  applications: ApplicationSummary[] | null;
  upcoming: UpcomingItem[] | null;
  recentActivity: ActivityItem[] | null;
  journey: CandidateJourney | null;
  resume: CandidateResumeInfo | null;
  engagement?: EngagementSummary | null;
  compliance?: ComplianceItem[] | null;
  weeklyCockpit?: WeeklyCockpit | null;
}

const STAGE_PILL_LABEL: Record<string, string> = {
  // Applicant-face keys
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  ONBOARDING: 'Onboarding',
  HIRED: 'Hired',
  EXITED: 'Closed',
  // Phase-2 intern-face keys
  SETUP: 'Setup',
  ACTIVE_WEEKS: 'Active weeks',
  EVALUATION: 'Evaluation',
  COMPLETED: 'Completed',
};

export default function CandidateDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['APPLICANT', 'INTERN']}>
      <DashboardLayout title="Dashboard">
        <CandidateDashboardBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function CandidateDashboardBody() {
  const { user } = useAuth();
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<CandidateDashboardResponse>(
        '/api/v1/candidate/dashboard',
      );
      setData(res.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your dashboard.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }
  if (data === null) return <DashboardSkeleton />;

  const apps = data.applications ?? [];
  const upcoming = data.upcoming ?? [];
  const activity = data.recentActivity ?? [];
  const journey = data.journey ?? null;
  const next = data.nextStep ?? null;
  const profilePct = data.profileComplete ?? 0;
  const stagePill = journey
    ? STAGE_PILL_LABEL[journey.currentStageKey] ?? journey.currentStageKey
    : null;
  // Phase-2 intern face — the backend sets engagement.status to ACTIVE only
  // for the active-intern path, and weeklyCockpit is populated there too. We
  // gate on both belt-and-braces so a partial response doesn't render a
  // broken cockpit.
  const isInternFace =
    data.engagement?.status === 'ACTIVE' && data.weeklyCockpit != null;

  return (
    <section className="space-y-8">
      {/* Welcome row — design-system PageHeader. The "Your Journey" panel below
          owns the next-step / stage pill / timeline — we no longer surface a
          separate horizontal bar or a duplicate next-step banner here. */}
      <DSPageHeader
        title={`Hi, ${(data.candidateName ?? user?.fullName ?? '').split(' ')[0] || 'there'}`}
        subtitle={
          user?.applicantId
            ? `Applicant ID ${user.applicantId} · ${stagePill ?? ''}`.trim()
            : (stagePill ? `Current stage: ${stagePill}` : undefined)
        }
      />

      {/* Full-width "Your Journey" panel: stage pill, next-step hero, full
          vertical timeline, recent activity. Polls every 30s. */}
      <YourJourneyPanel />

      {isInternFace ? (
        <>
          {/* Intern cockpit — this week's material / report / timesheet */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ThisWeekMaterialCard
              material={data.weeklyCockpit!.material}
              onChanged={() => void load()}
            />
            <ThisWeekReportCard report={data.weeklyCockpit!.report} />
            <ThisWeekTimesheetCard timesheet={data.weeklyCockpit!.timesheet} />
          </div>

          {/* Active project — most-actionable allocated work. */}
          {data.weeklyCockpit!.project && (
            <ActiveProjectCard project={data.weeklyCockpit!.project} />
          )}

          {/* Latest evaluation — pending I-983 self-review OR most-recent finalized */}
          {data.weeklyCockpit!.latestEvaluation && (
            <LatestEvaluationCard
              evaluation={data.weeklyCockpit!.latestEvaluation}
            />
          )}

          {/* Compliance & Authorization strip — only when we have anything to show */}
          {(((data.compliance ?? []).length > 0) ||
            data.weeklyCockpit!.authorization != null) && (
            <ComplianceAuthStrip
              items={data.compliance ?? []}
              auth={data.weeklyCockpit!.authorization}
            />
          )}
        </>
      ) : (
        <>
          {/* Applicant face — 3-up status cards: application / profile / resume */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ApplicationStatusCard apps={apps} />
            <ProfileCompletenessCard pct={profilePct} />
            <ResumeCard resume={data.resume ?? null} />
          </div>
        </>
      )}

      {/* Upcoming + Recent activity (both faces) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingAgenda items={upcoming} profilePct={profilePct} />
        <RecentActivityFeed items={activity} />
      </div>
    </section>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({
  candidateName,
  applicantId,
  stagePill,
  stageIsExited,
}: {
  candidateName: string | null;
  applicantId: string | null;
  stagePill: string | null;
  stageIsExited: boolean;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back{candidateName ? `, ${candidateName}` : ''}.
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {applicantId && (
            <span
              className="rounded-full border border-accent/30 bg-accent/5 px-2.5 py-1 font-medium text-accent-dark"
              title="Your Skyzen Applicant ID"
            >
              ID: {applicantId}
            </span>
          )}
          {stagePill && (
            <span
              className={
                stageIsExited
                  ? 'rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700 ring-1 ring-red-200'
                  : 'rounded-full bg-accent/15 px-2.5 py-1 font-medium text-accent-dark ring-1 ring-accent/30'
              }
            >
              Current stage: {stagePill}
            </span>
          )}
        </div>
      </div>
      {/* SPEC §2.1 — notification bell placeholder. Real unread-count wires
          to a future communications/notifications endpoint (GAP_REPORT C3). */}
      <button
        type="button"
        aria-label="Notifications (coming soon)"
        title="Notifications — coming soon"
        className="relative rounded-full border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50"
      >
        <Bell className="h-4 w-4" strokeWidth={2} />
      </button>
    </header>
  );
}

// ── Next-step hero ──────────────────────────────────────────────────────────

function NextStepHero({ step }: { step: NextStep }) {
  // SPEC §5 — three visual variants:
  //   - urgent: live offer to respond to (amber)
  //   - waiting: someone else's turn (info-tinted, no primary CTA emphasis)
  //   - action: user's turn (accent)
  const urgent = step.type === 'OFFER';
  const waiting = !!step.isWaiting;

  const wrap = urgent
    ? 'rounded-xl border-2 border-amber-300 bg-amber-50 p-6'
    : waiting
      ? 'rounded-xl border-2 border-sky-200 bg-sky-50 p-6'
      : 'rounded-xl border-2 border-accent/40 bg-accent/5 p-6';
  const iconWrap = urgent
    ? 'bg-amber-200 text-amber-800'
    : waiting
      ? 'bg-sky-200 text-sky-800'
      : 'bg-accent text-white';
  const cta = urgent
    ? 'inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600'
    : waiting
      ? 'inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100'
      : 'inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90';

  return (
    <div className={wrap}>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconWrap}`}
        >
          <NextStepIcon type={step.type} waiting={waiting} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold text-gray-900">
              {step.title ?? 'Next step'}
            </div>
            {waiting && (
              <span className="rounded-full bg-sky-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                Waiting
              </span>
            )}
          </div>
          {step.subtitle && (
            <div className="mt-0.5 text-sm text-gray-700">{step.subtitle}</div>
          )}
          {waiting && step.waitingFor && (
            <div className="mt-1 text-xs italic text-sky-800">
              {step.waitingFor}
              {step.expectedBy && ` · expected by ${formatRelative(step.expectedBy)}`}
            </div>
          )}
        </div>
        {step.ctaLabel && step.ctaHref && (
          <Link href={step.ctaHref} className={cta}>
            {step.ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function NextStepIcon({ type, waiting }: { type: string; waiting: boolean }) {
  const cn = 'h-5 w-5';
  if (waiting) return <Clock className={cn} strokeWidth={2} />;
  switch (type) {
    case 'OFFER':
      return <FileSignature className={cn} strokeWidth={2} />;
    case 'INTERVIEW':
      return <CalendarClock className={cn} strokeWidth={2} />;
    case 'ONBOARDING':
    case 'WORK':
    case 'SCREENING':
      return <ClipboardList className={cn} strokeWidth={2} />;
    case 'PROFILE':
      return <UserCircle className={cn} strokeWidth={2} />;
    case 'BROWSE':
    case 'EXITED':
      return <Briefcase className={cn} strokeWidth={2} />;
    case 'WELCOME':
      return <Sparkles className={cn} strokeWidth={2} />;
    default:
      return <Sparkles className={cn} strokeWidth={2} />;
  }
}

// ── Status cards (3-up) ─────────────────────────────────────────────────────

function ApplicationStatusCard({ apps }: { apps: ApplicationSummary[] }) {
  const top = apps[0] ?? null;
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Application</h2>
      </div>
      {top ? (
        <>
          <p className="truncate text-sm font-medium text-gray-900">
            {top.position ?? '—'}
          </p>
          {top.entityName && (
            <p className="truncate text-xs text-gray-500">{top.entityName}</p>
          )}
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-accent-dark">
            {top.status ?? '—'}
          </p>
          {apps.length > 1 && (
            <Link
              href="/careers/candidate/applications"
              className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
            >
              View all {apps.length} applications →
            </Link>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">No applications yet.</p>
          <Link
            href="/careers/openings"
            className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
          >
            Browse openings →
          </Link>
        </>
      )}
    </article>
  );
}

function ProfileCompletenessCard({ pct }: { pct: number }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2">
        <UserCircle className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
      </div>
      <p className="mb-3 text-lg font-semibold text-gray-900">{pct}% complete</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct < 100 && (
        <Link
          href="/careers/candidate/profile"
          className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
        >
          Finish your profile →
        </Link>
      )}
    </article>
  );
}

function ResumeCard({ resume }: { resume: CandidateResumeInfo | null }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Resume</h2>
      </div>
      {resume ? (
        <>
          <p
            className="truncate text-sm font-medium text-gray-900"
            title={resume.fileName}
          >
            {resume.fileName}
          </p>
          {resume.uploadedAt && (
            <p className="text-xs text-gray-500">
              Uploaded {formatRelative(resume.uploadedAt)}
            </p>
          )}
          <Link
            href="/careers/candidate/profile"
            className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
          >
            Manage resumes →
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">No resume uploaded.</p>
          <Link
            href="/careers/openings"
            className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
          >
            Upload via the apply flow →
          </Link>
        </>
      )}
    </article>
  );
}

// ── Upcoming + Recent activity ──────────────────────────────────────────────

function UpcomingAgenda({
  items,
  profilePct,
}: {
  items: UpcomingItem[];
  profilePct: number;
}) {
  const showProfileNudge = profilePct < 100;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Upcoming</h2>
      {items.length === 0 && !showProfileNudge ? (
        <p className="text-sm text-gray-500">Nothing on the calendar.</p>
      ) : (
        <ul className="space-y-3">
          {showProfileNudge && (
            <li>
              <Link
                href="/careers/candidate/profile"
                className="-mx-2 flex items-start gap-3 rounded-md p-2 hover:bg-gray-50"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <UserCircle className="h-4 w-4" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    Finish your profile
                  </div>
                  <div className="text-xs text-gray-500">{profilePct}% complete</div>
                </div>
              </Link>
            </li>
          )}
          {items.map((u, i) => (
            <li key={`${u.type}-${i}`} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                <UpcomingIcon type={u.type} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900">
                  {u.title ?? '—'}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {u.at ? formatRelative(u.at) : '—'}
                  {u.subtitle ? ` · ${u.subtitle}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UpcomingIcon({ type }: { type: string }) {
  const cn = 'h-3.5 w-3.5';
  switch (type) {
    case 'INTERVIEW':
    case 'EVALUATION':
      return <CalendarClock className={cn} strokeWidth={2} />;
    case 'OFFER_EXPIRY':
      return <FileSignature className={cn} strokeWidth={2} />;
    case 'ONBOARDING_DUE':
      return <ClipboardList className={cn} strokeWidth={2} />;
    default:
      return <Clock className={cn} strokeWidth={2} />;
  }
}

function RecentActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent activity</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No recent activity.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((a, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
              />
              <div className="min-w-0">
                <div className="text-sm text-gray-900">{a.text ?? '—'}</div>
                <div className="text-xs text-gray-500">
                  {a.at ? formatRelative(a.at) : '—'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Phase-2 intern cockpit cards ────────────────────────────────────────────

const REPORT_PILL: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-sky-100 text-sky-800',
  RETURNED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
};

const TIMESHEET_PILL: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-sky-100 text-sky-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-amber-100 text-amber-800',
};

function ThisWeekMaterialCard({
  material,
  onChanged,
}: {
  material: MaterialCard | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ack = async () => {
    if (!material || material.acknowledged) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/api/v1/weekly-materials/${material.id}/acknowledge`);
      onChanged();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? "Couldn't mark as read.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">This week's material</h2>
      </div>
      {material == null ? (
        <>
          <p className="text-sm text-gray-600">No material released yet this week.</p>
          <p className="mt-1 text-xs text-gray-500">
            Your supervisor will post one shortly.
          </p>
        </>
      ) : (
        <>
          <p className="truncate text-sm font-medium text-gray-900" title={material.title}>
            {material.title}
          </p>
          {material.weekNo != null && (
            <p className="text-xs text-gray-500">Week {material.weekNo}</p>
          )}
          {material.acknowledged ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
              Acknowledged
              {material.acknowledgedAt && (
                <span className="ml-1 normal-case text-emerald-700">
                  · {formatRelative(material.acknowledgedAt)}
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void ack()}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              {busy ? 'Marking…' : 'Acknowledge'}
            </button>
          )}
          {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
          <Link
            href={material.href}
            className="mt-3 ml-3 inline-block text-xs font-medium text-accent hover:underline"
          >
            Open materials →
          </Link>
        </>
      )}
    </article>
  );
}

function ThisWeekReportCard({ report }: { report: ReportCard | null }) {
  const status = report?.status ?? null;
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Weekly report</h2>
      </div>
      {status == null ? (
        <>
          <p className="text-sm text-gray-600">Not started.</p>
          <p className="mt-1 text-xs text-gray-500">
            Log completed work, blockers, learnings, and next plan.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span
              className={
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                (REPORT_PILL[status] ?? 'bg-gray-100 text-gray-700')
              }
            >
              {status}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {report?.submittedAt ? `Submitted ${formatRelative(report.submittedAt)}` : null}
            {report?.reviewedAt
              ? (report?.submittedAt ? ' · ' : '') +
                `Reviewed ${formatRelative(report.reviewedAt)}`
              : null}
          </p>
          {status === 'RETURNED' && report?.reviewNotes && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <span className="font-semibold">Note: </span>
              {report.reviewNotes}
            </div>
          )}
        </>
      )}
      <Link
        href={report?.href ?? '/careers/candidate/weekly-reports'}
        className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
      >
        {status === 'APPROVED' ? 'View report →' : 'Open report →'}
      </Link>
    </article>
  );
}

function ThisWeekTimesheetCard({ timesheet }: { timesheet: TimesheetCard | null }) {
  const status = timesheet?.status ?? null;
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Timesheet</h2>
      </div>
      {status == null ? (
        <>
          <p className="text-sm text-gray-600">No hours logged yet.</p>
          <p className="mt-1 text-xs text-gray-500">Track your time as you work.</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span
              className={
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                (TIMESHEET_PILL[status] ?? 'bg-gray-100 text-gray-700')
              }
            >
              {status}
            </span>
            {timesheet?.hours != null && (
              <span className="text-sm font-semibold text-gray-900">
                {String(timesheet.hours)} hrs
              </span>
            )}
          </div>
        </>
      )}
      <Link
        href={timesheet?.href ?? '/careers/intern/work'}
        className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
      >
        {status === 'APPROVED' ? 'View timesheet →' : 'Open timesheet →'}
      </Link>
    </article>
  );
}

// ── Active project (intern cockpit) ─────────────────────────────────────────

const PROJECT_PILL: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-sky-100 text-sky-800',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  RETURNED: 'bg-orange-100 text-orange-800',
};

function ActiveProjectCard({ project }: { project: ProjectCard }) {
  const status = project.status;
  const pct = Math.max(0, Math.min(100, project.progressPct ?? 0));
  const isReturned = status === 'RETURNED';
  return (
    <article
      className={
        'rounded-lg border bg-white p-5 ' +
        (isReturned ? 'border-orange-200' : 'border-gray-200')
      }
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-accent" strokeWidth={2} />
            <h2 className="text-sm font-semibold text-gray-900">Active project</h2>
            <span
              className={
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                (PROJECT_PILL[status] ?? 'bg-gray-100 text-gray-700')
              }
            >
              {status.replaceAll('_', ' ')}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-gray-900">
            {project.title}
          </p>
          {project.dueDate && (
            <p className="text-xs text-gray-500">Due {project.dueDate}</p>
          )}
        </div>
        <div className="text-right text-xs font-semibold text-gray-700">
          {pct}%
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      {isReturned && project.reviewNotes && (
        <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-2 text-xs text-orange-900">
          <span className="font-semibold">Supervisor returned this: </span>
          {project.reviewNotes}
        </div>
      )}
      <Link
        href={project.href}
        className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
      >
        {isReturned ? 'Open and resubmit →' : 'Open project →'}
      </Link>
    </article>
  );
}

// ── Latest evaluation (intern cockpit) ──────────────────────────────────────

const EVAL_TYPE_LABEL: Record<string, string> = {
  MIDPOINT: 'Midpoint',
  FINAL: 'Final',
  I983_12MO: 'I-983 12-month',
  I983_FINAL: 'I-983 final',
  CHECKPOINT: 'Checkpoint',
};

function LatestEvaluationCard({ evaluation }: { evaluation: EvaluationCard }) {
  const typeLabel = evaluation.type
    ? EVAL_TYPE_LABEL[evaluation.type] ?? evaluation.type
    : 'Evaluation';
  if (evaluation.selfReviewPending) {
    return (
      <article className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-700" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-amber-900">
            {typeLabel} — your reflection is requested
          </h2>
        </div>
        <p className="text-sm text-amber-900/90">
          Your supervisor started an I-983 evaluation. Add a short self-review
          before it&apos;s finalized.
        </p>
        <Link
          href={evaluation.href}
          className="mt-3 inline-block text-xs font-medium text-amber-900 underline hover:no-underline"
        >
          Add self-review →
        </Link>
      </article>
    );
  }
  return (
    <article className="rounded-lg border border-emerald-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2">
        <Star className="h-4 w-4 text-emerald-700" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">
          Latest evaluation
        </h2>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
          Finalized
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900">{typeLabel}</p>
      {typeof evaluation.overallRating === 'number' && (
        <div className="mt-1 flex items-center gap-1" aria-label={`${evaluation.overallRating} of 5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={
                'h-3.5 w-3.5 ' +
                (i <= (evaluation.overallRating ?? 0)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300')
              }
              strokeWidth={2}
            />
          ))}
        </div>
      )}
      <Link
        href={evaluation.href}
        className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
      >
        View evaluation →
      </Link>
    </article>
  );
}

// ── Compliance + authorization strip (intern face) ──────────────────────────

function ComplianceAuthStrip({
  items,
  auth,
}: {
  items: ComplianceItem[];
  auth: AuthorizationInfo | null;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">
          Compliance & authorization
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <ComplianceRow key={c.kind} item={c} />
        ))}
        {auth && <AuthorizationRow auth={auth} />}
      </div>
    </section>
  );
}

function ComplianceRow({ item }: { item: ComplianceItem }) {
  const tone = complianceTone(item.state);
  const inner = (
    <div
      className={
        'flex items-start gap-3 rounded-md border p-3 transition-colors ' + tone.wrap
      }
    >
      <div
        className={
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full ' + tone.iconWrap
        }
      >
        {tone.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-gray-900">{item.label}</div>
        {item.subtitle && (
          <div className="truncate text-[11px] text-gray-600">{item.subtitle}</div>
        )}
      </div>
    </div>
  );
  if (item.href) {
    return (
      <Link href={item.href} className="block hover:opacity-90">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

function complianceTone(state: string): {
  wrap: string;
  iconWrap: string;
  icon: React.ReactNode;
} {
  switch (state) {
    case 'COMPLETED':
      return {
        wrap: 'border-emerald-200 bg-emerald-50',
        iconWrap: 'bg-emerald-100 text-emerald-700',
        icon: <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />,
      };
    case 'BLOCKED':
      return {
        wrap: 'border-red-200 bg-red-50',
        iconWrap: 'bg-red-100 text-red-700',
        icon: <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.5} />,
      };
    case 'AWAITING_HR':
    case 'IN_PROGRESS':
      return {
        wrap: 'border-amber-200 bg-amber-50',
        iconWrap: 'bg-amber-100 text-amber-700',
        icon: <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />,
      };
    case 'NOT_STARTED':
    default:
      return {
        wrap: 'border-gray-200 bg-white',
        iconWrap: 'bg-gray-100 text-gray-500',
        icon: <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />,
      };
  }
}

function AuthorizationRow({ auth }: { auth: AuthorizationInfo }) {
  const days = auth.daysUntilExpiry;
  const tone =
    days == null
      ? 'border-gray-200 bg-white'
      : days < 0
        ? 'border-red-200 bg-red-50'
        : days <= 30
          ? 'border-red-200 bg-red-50'
          : days <= 90
            ? 'border-amber-200 bg-amber-50'
            : 'border-emerald-200 bg-emerald-50';
  const iconWrap =
    days == null
      ? 'bg-gray-100 text-gray-500'
      : days < 0 || days <= 30
        ? 'bg-red-100 text-red-700'
        : days <= 90
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700';
  return (
    <div className={'flex items-start gap-3 rounded-md border p-3 ' + tone}>
      <div
        className={
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full ' + iconWrap
        }
      >
        <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-gray-900">
          Authorized through: {auth.authType}
        </div>
        <div className="truncate text-[11px] text-gray-600">
          {auth.expirationDate ?? '—'}
          {auth.daysUntilExpiry != null && (
            <>
              {' · '}
              {auth.daysUntilExpiry >= 0
                ? `${formatDueDate(auth.expirationDate)}`
                : `${Math.abs(auth.daysUntilExpiry)} days overdue`}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="h-36 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      <div className="h-24 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg border border-gray-100 bg-gray-50"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
        <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      </div>
    </div>
  );
}

