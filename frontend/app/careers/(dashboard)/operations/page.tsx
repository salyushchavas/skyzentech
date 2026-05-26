'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Briefcase,
  CalendarClock,
  ClipboardList,
  FileCheck,
  FileSignature,
  KanbanSquare,
  ListChecks,
  TrendingUp,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRelative } from '@/lib/format-date';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import type { ApplicationStatus, Uuid } from '@/types';

/**
 * Operations command center. Hiring + program overview for the recruiter/ERM
 * role. Reuses the candidate dashboard's card grammar (rounded-lg cards on
 * white, accent-coloured headings, formatRelative for times) so the two
 * surfaces feel like one product.
 *
 * Backed by GET /api/v1/operations/dashboard.
 *
 * What this view DOESN'T show — by deliberate design:
 *   - No compliance state (I-9 / I-983 / E-Verify) — that's HR_COMPLIANCE.
 *   - No user/role/audit-log management — that's SUPER_ADMIN.
 *   - No comms log yet — the backend will surface it once one exists.
 */

interface PipelineFunnel {
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  onboarding: number;
}

interface ActionItem {
  key: string;
  label: string;
  count: number;
  href: string;
}

interface UpcomingInterview {
  id: Uuid;
  applicationId: Uuid | null;
  candidateName: string | null;
  position: string | null;
  scheduledAt: string | null;
  type: string | null;
  interviewerName: string | null;
}

interface OnboardingQueueItem {
  engagementId: Uuid;
  candidateId: Uuid;
  candidateName: string | null;
  position: string | null;
  status: string | null;
  pendingTaskCount: number;
}

interface RecentApplication {
  id: Uuid;
  candidateName: string | null;
  position: string | null;
  entityName: string | null;
  status: ApplicationStatus | null;
  appliedAt: string | null;
}

interface OpenPosting {
  id: Uuid;
  title: string;
  entityName: string | null;
  applicationCount: number;
}

interface OperationsDashboardResponse {
  operatorName: string | null;
  pipeline: PipelineFunnel;
  needsAttention: ActionItem[];
  upcomingInterviews: UpcomingInterview[];
  pendingScorecards: number;
  onboardingQueue: OnboardingQueueItem[];
  recentApplications: RecentApplication[];
  openPostings: OpenPosting[];
}

const FUNNEL_STAGES: ReadonlyArray<{ key: keyof PipelineFunnel; label: string }> = [
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'onboarding', label: 'Onboarding' },
];

const STATUS_PILL: Record<string, string> = {
  APPLIED: 'bg-gray-100 text-gray-700',
  SCREENING_SENT: 'bg-amber-100 text-amber-800',
  SCREENING_COMPLETED: 'bg-amber-100 text-amber-800',
  SHORTLISTED: 'bg-sky-100 text-sky-800',
  INTERVIEW_SCHEDULED: 'bg-indigo-100 text-indigo-800',
  INTERVIEWED: 'bg-indigo-100 text-indigo-800',
  SELECTED_CONDITIONAL: 'bg-violet-100 text-violet-800',
  OFFERED: 'bg-violet-100 text-violet-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
};

const ENGAGEMENT_PILL: Record<string, string> = {
  PENDING_COMPLIANCE: 'bg-amber-100 text-amber-800',
  READY_TO_START: 'bg-emerald-100 text-emerald-800',
};

export default function OperationsDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'SUPER_ADMIN']}>
      <DashboardLayout title="Operations Dashboard">
        <OperationsDashboardBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function OperationsDashboardBody() {
  const { user } = useAuth();
  const [data, setData] = useState<OperationsDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<OperationsDashboardResponse>(
        '/api/v1/operations/dashboard',
      );
      setData(res.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the dashboard.");
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

  const operatorName = data.operatorName ?? user?.fullName ?? null;
  const totalInFlight =
    data.pipeline.applied +
    data.pipeline.screening +
    data.pipeline.interview +
    data.pipeline.offer +
    data.pipeline.onboarding;
  const totalActionItems = data.needsAttention.reduce((s, a) => s + a.count, 0);

  return (
    <section className="space-y-6">
      <Header
        operatorName={operatorName}
        totalInFlight={totalInFlight}
        totalActionItems={totalActionItems}
      />

      <NeedsAttention items={data.needsAttention} />

      <PipelineFunnelCard pipeline={data.pipeline} totalInFlight={totalInFlight} />

      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingInterviewsCard
          items={data.upcomingInterviews}
          pendingScorecards={data.pendingScorecards}
        />
        <OnboardingQueueCard items={data.onboardingQueue} />
      </div>

      <RecentApplicationsCard items={data.recentApplications} />

      <OpenPostingsCard items={data.openPostings} />
    </section>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({
  operatorName,
  totalInFlight,
  totalActionItems,
}: {
  operatorName: string | null;
  totalInFlight: number;
  totalActionItems: number;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back{operatorName ? `, ${operatorName}` : ''}.
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span
            className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-800"
            title="You're signed in as Operations"
          >
            Operations
          </span>
          <span className="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent-dark">
            {totalInFlight} in pipeline
          </span>
          {totalActionItems > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
              {totalActionItems} action{totalActionItems === 1 ? '' : 's'} pending
            </span>
          )}
        </div>
      </div>
      {/* Notification bell — same placeholder pattern as candidate dashboard.
          Wires to a comms/notifications endpoint when one exists. */}
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

// ── Needs your attention ────────────────────────────────────────────────────

function NeedsAttention({ items }: { items: ActionItem[] }) {
  const hot = items.filter((i) => i.count > 0);
  const allQuiet = hot.length === 0;

  return (
    <section className="rounded-xl border-2 border-accent/30 bg-accent/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent-dark">
          Needs your attention
        </h2>
        {allQuiet && (
          <span className="text-xs italic text-gray-500">All clear — nice work.</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={
              'group flex items-start gap-3 rounded-lg border p-3 transition-colors ' +
              (item.count > 0
                ? 'border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50'
                : 'border-gray-200 bg-white/70 hover:bg-gray-50')
            }
          >
            <div
              className={
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' +
                (item.count > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500')
              }
            >
              <ActionIcon keyName={item.key} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={
                    'text-lg font-semibold ' +
                    (item.count > 0 ? 'text-gray-900' : 'text-gray-400')
                  }
                >
                  {item.count}
                </span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-gray-400 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-0.5 truncate text-xs font-medium text-gray-700">
                {item.label}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ActionIcon({ keyName }: { keyName: string }) {
  const cn = 'h-4 w-4';
  switch (keyName) {
    case 'NEW_APPLICATIONS':
      return <FileCheck className={cn} strokeWidth={2} />;
    case 'SCREENINGS_TO_ASSIGN':
      return <ClipboardList className={cn} strokeWidth={2} />;
    case 'INTERVIEWS_TO_SCHEDULE':
      return <CalendarClock className={cn} strokeWidth={2} />;
    case 'SCORECARDS_TO_SUBMIT':
      return <FileSignature className={cn} strokeWidth={2} />;
    case 'ONBOARDING_TO_ACTION':
      return <ListChecks className={cn} strokeWidth={2} />;
    default:
      return <TrendingUp className={cn} strokeWidth={2} />;
  }
}

// ── Pipeline funnel ─────────────────────────────────────────────────────────

function PipelineFunnelCard({
  pipeline,
  totalInFlight,
}: {
  pipeline: PipelineFunnel;
  totalInFlight: number;
}) {
  // Peak band height drives the bar scaling; a flat bar at the floor when zero.
  const maxCount = Math.max(
    pipeline.applied,
    pipeline.screening,
    pipeline.interview,
    pipeline.offer,
    pipeline.onboarding,
    1,
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <KanbanSquare className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Pipeline</h2>
        </div>
        <Link
          href="/careers/recruiter"
          className="text-xs font-medium text-accent hover:underline"
        >
          Open pipeline →
        </Link>
      </div>
      {totalInFlight === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No active applications yet. Postings will fill this once candidates apply.
        </p>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {FUNNEL_STAGES.map((stage) => {
            const count = pipeline[stage.key];
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={stage.key} className="flex flex-col items-center">
                <div className="flex h-24 w-full items-end justify-center">
                  <div
                    aria-hidden="true"
                    className="w-full rounded-t bg-accent/70 transition-all"
                    style={{ height: count === 0 ? '4px' : `${Math.max(pct, 10)}%` }}
                  />
                </div>
                <div className="mt-2 text-lg font-semibold text-gray-900">{count}</div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {stage.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Upcoming interviews ─────────────────────────────────────────────────────

function UpcomingInterviewsCard({
  items,
  pendingScorecards,
}: {
  items: UpcomingInterview[];
  pendingScorecards: number;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Upcoming interviews</h2>
        </div>
        {pendingScorecards > 0 && (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
            title="Past-due interviews still awaiting a scorecard"
          >
            {pendingScorecards} pending scorecard{pendingScorecards === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No interviews scheduled.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((iv) => (
            <li key={iv.id} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={
                    iv.applicationId
                      ? `/careers/recruiter/applications/${iv.applicationId}`
                      : '/careers/erm/interviews'
                  }
                  className="block truncate text-sm font-medium text-gray-900 hover:text-accent-dark hover:underline"
                >
                  {iv.candidateName ?? '—'}
                </Link>
                <div className="truncate text-xs text-gray-500">
                  {iv.position ?? '—'}
                  {iv.interviewerName ? ` · with ${iv.interviewerName}` : ''}
                </div>
                <div className="text-xs text-gray-500">
                  {iv.scheduledAt ? formatRelative(iv.scheduledAt) : '—'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Onboarding queue ────────────────────────────────────────────────────────

function OnboardingQueueCard({ items }: { items: OnboardingQueueItem[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Onboarding queue</h2>
        </div>
        <Link
          href="/careers/supervised"
          className="text-xs font-medium text-accent hover:underline"
        >
          All interns →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No one in onboarding right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.engagementId} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Users className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/careers/supervised/${row.candidateId}`}
                  className="block truncate text-sm font-medium text-gray-900 hover:text-accent-dark hover:underline"
                >
                  {row.candidateName ?? '—'}
                </Link>
                <div className="truncate text-xs text-gray-500">{row.position ?? '—'}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {row.status && (
                  <span
                    className={
                      'whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium ' +
                      (ENGAGEMENT_PILL[row.status] ?? 'bg-gray-100 text-gray-700')
                    }
                  >
                    {row.status.replaceAll('_', ' ')}
                  </span>
                )}
                {row.pendingTaskCount > 0 && (
                  <span className="whitespace-nowrap text-[10px] text-gray-500">
                    {row.pendingTaskCount} task{row.pendingTaskCount === 1 ? '' : 's'} pending
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Recent applications ─────────────────────────────────────────────────────

function RecentApplicationsCard({ items }: { items: RecentApplication[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Recent applications</h2>
        </div>
        <Link
          href="/careers/recruiter"
          className="text-xs font-medium text-accent hover:underline"
        >
          View all →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No applications yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/careers/recruiter/applications/${a.id}`}
                  className="block truncate text-sm font-medium text-gray-900 hover:text-accent-dark hover:underline"
                >
                  {a.candidateName ?? '—'}
                </Link>
                <div className="truncate text-xs text-gray-500">
                  {a.position ?? '—'}
                  {a.entityName ? ` · ${a.entityName}` : ''}
                </div>
              </div>
              {a.status && (
                <span
                  className={
                    'whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                    (STATUS_PILL[a.status] ?? 'bg-gray-100 text-gray-700')
                  }
                >
                  {a.status.replaceAll('_', ' ')}
                </span>
              )}
              <div className="hidden whitespace-nowrap text-xs text-gray-500 sm:block">
                {a.appliedAt ? formatRelative(a.appliedAt) : '—'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Open postings ───────────────────────────────────────────────────────────

function OpenPostingsCard({ items }: { items: OpenPosting[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Open postings</h2>
        </div>
        <Link
          href="/careers/admin/postings"
          className="text-xs font-medium text-accent hover:underline"
        >
          Manage postings →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No open postings.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/careers/admin/postings`}
              className="block rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-accent/40 hover:bg-accent/5"
            >
              <div className="truncate text-sm font-semibold text-gray-900">
                {p.title}
              </div>
              {p.entityName && (
                <div className="truncate text-xs text-gray-500">{p.entityName}</div>
              )}
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-dark">
                <Users className="h-3 w-3" strokeWidth={2} />
                {p.applicationCount} application{p.applicationCount === 1 ? '' : 's'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="h-28 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-44 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
        <div className="h-44 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      </div>
      <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
    </div>
  );
}
