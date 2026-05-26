'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  BookOpen,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Clock,
  FileSignature,
  FileText,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { formatRelative } from '@/lib/format-date';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import JourneyBar from '@/components/dashboard/JourneyBar';
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

interface CandidateDashboardResponse {
  candidateName: string | null;
  profileComplete: number;
  nextStep: NextStep | null;
  applications: ApplicationSummary[] | null;
  upcoming: UpcomingItem[] | null;
  recentActivity: ActivityItem[] | null;
  journey: CandidateJourney | null;
  resume: CandidateResumeInfo | null;
}

const STAGE_PILL_LABEL: Record<string, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  ONBOARDING: 'Onboarding',
  HIRED: 'Hired',
  EXITED: 'Closed',
};

export default function CandidateDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
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

  return (
    <section className="space-y-6">
      {/* SPEC §2.1 — Header: greeting, applicant ID, stage pill, bell */}
      <Header
        candidateName={data.candidateName ?? user?.fullName ?? null}
        applicantId={user?.applicantId ?? null}
        stagePill={stagePill}
        stageIsExited={journey?.isExited ?? false}
      />

      {/* SPEC §2.2 — Journey bar */}
      {journey && <JourneyBar journey={journey} />}

      {/* SPEC §2.3 — Next-step hero (or waiting variant) */}
      {next && <NextStepHero step={next} />}

      {/* SPEC §2.4 — 3-up status cards: application / profile / resume */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ApplicationStatusCard apps={apps} />
        <ProfileCompletenessCard pct={profilePct} />
        <ResumeCard resume={data.resume ?? null} />
      </div>

      {/* SPEC §2.5 — Upcoming + Recent activity */}
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

// `BookOpen` re-exported as a placeholder for future intern-face widgets.
// Keeps the import list stable when we extend this file for Phase 2.
export const _UnusedBookOpen = BookOpen;
