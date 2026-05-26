'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatRelative } from '@/lib/format-date';
import { useAuth } from '@/lib/auth-context';
import type { Uuid } from '@/types';

/**
 * Technical Supervisor dashboard. Phase-2 weekly cockpit for the supervisor
 * side: action queue + assigned-interns roster + upcoming evaluations +
 * recent activity. Backed by GET /api/v1/supervisor/dashboard, scoped
 * server-side to ACTIVE engagements the caller supervises (SUPER_ADMIN
 * sees everything).
 *
 * Reuses the candidate / operations / HR dashboard card grammar — same
 * rounded-lg cards on white, accent header strip, pill-styled statuses.
 */
export default function SupervisorDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_SUPERVISOR', 'SUPER_ADMIN']}>
      <DashboardLayout title="Supervisor Dashboard">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

interface SupervisorActionItem {
  key: string;
  label: string;
  count: number;
  href: string;
}

type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';
type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

interface InternRosterRow {
  candidateId: Uuid;
  engagementId: Uuid;
  internName: string | null;
  position: string | null;
  entityName: string | null;
  weekStart: string;
  materialAcknowledged: boolean | null;
  reportStatus: ReportStatus | null;
  timesheetStatus: TimesheetStatus | null;
  lastActivityAt: string | null;
  reviewHref: string;
}

interface SupervisorUpcoming {
  type: 'EVALUATION' | 'REPORT_DEADLINE' | 'TIMESHEET_DEADLINE';
  title: string;
  subtitle: string | null;
  at: string | null;
  href: string | null;
}

interface SupervisorActivity {
  timestamp: string | null;
  summary: string;
  internName: string | null;
  entityType: string | null;
  href: string | null;
}

interface SupervisorDashboardResponse {
  supervisorName: string | null;
  isSuperAdminView: boolean;
  needsAttention: SupervisorActionItem[];
  internRoster: InternRosterRow[];
  upcoming: SupervisorUpcoming[];
  recentActivity: SupervisorActivity[];
}

const REPORT_PILL: Record<ReportStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-sky-100 text-sky-800',
  RETURNED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
};

const TIMESHEET_PILL: Record<TimesheetStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-sky-100 text-sky-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-amber-100 text-amber-800',
};

function Body() {
  const { user } = useAuth();
  const [data, setData] = useState<SupervisorDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<SupervisorDashboardResponse>(
        '/api/v1/supervisor/dashboard',
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
  if (data === null) return <Skeleton />;

  const supervisorName = data.supervisorName ?? user?.fullName ?? null;
  const totalActions = data.needsAttention.reduce((s, a) => s + a.count, 0);

  return (
    <section className="space-y-6">
      <Header
        supervisorName={supervisorName}
        totalActions={totalActions}
        isSuperAdminView={data.isSuperAdminView}
        rosterSize={data.internRoster.length}
      />

      <NeedsAttention items={data.needsAttention} />

      <RosterCard roster={data.internRoster} />

      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingCard items={data.upcoming} />
        <RecentActivityCard items={data.recentActivity} />
      </div>
    </section>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({
  supervisorName,
  totalActions,
  isSuperAdminView,
  rosterSize,
}: {
  supervisorName: string | null;
  totalActions: number;
  isSuperAdminView: boolean;
  rosterSize: number;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back{supervisorName ? `, ${supervisorName}` : ''}.
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span
            className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800"
            title="You're signed in as Technical Supervisor"
          >
            Technical Supervisor
          </span>
          {isSuperAdminView && (
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-medium text-indigo-800">
              Super-admin view — all active engagements
            </span>
          )}
          <span className="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent-dark">
            {rosterSize} active intern{rosterSize === 1 ? '' : 's'}
          </span>
          {totalActions > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
              {totalActions} action{totalActions === 1 ? '' : 's'} pending
            </span>
          )}
        </div>
      </div>
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

function NeedsAttention({ items }: { items: SupervisorActionItem[] }) {
  const allQuiet = items.every((i) => i.count === 0);
  return (
    <section className="rounded-xl border-2 border-accent/30 bg-accent/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent-dark">
          Needs your attention
        </h2>
        {allQuiet && (
          <span className="text-xs italic text-gray-500">All clear — great work.</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <p className="mt-0.5 text-xs font-medium text-gray-700">{item.label}</p>
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
    case 'REPORTS_TO_REVIEW':
      return <FileText className={cn} strokeWidth={2} />;
    case 'TIMESHEETS_TO_APPROVE':
      return <Clock className={cn} strokeWidth={2} />;
    case 'PROJECTS_TO_REVIEW':
      return <ClipboardList className={cn} strokeWidth={2} />;
    case 'EVALUATIONS_DUE':
      return <CalendarClock className={cn} strokeWidth={2} />;
    case 'MATERIALS_TO_PUBLISH':
      return <BookOpen className={cn} strokeWidth={2} />;
    default:
      return <TrendingUp className={cn} strokeWidth={2} />;
  }
}

// ── Roster ──────────────────────────────────────────────────────────────────

function RosterCard({ roster }: { roster: InternRosterRow[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Assigned interns</h2>
        </div>
        <span className="text-[11px] italic text-gray-500">
          Sorted by what needs you most
        </span>
      </div>
      {roster.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No active interns assigned to you yet. New assignments appear here once
          their engagement goes active.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {roster.map((r) => (
            <li key={r.engagementId} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={r.reviewHref}
                  className="block truncate text-sm font-medium text-gray-900 hover:text-accent-dark hover:underline"
                >
                  {r.internName ?? '—'}
                </Link>
                <div className="truncate text-xs text-gray-500">
                  {r.position ?? '—'}
                  {r.entityName ? ` · ${r.entityName}` : ''}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <MaterialPill acked={r.materialAcknowledged} />
                <ReportPill status={r.reportStatus} />
                <TimesheetPillBadge status={r.timesheetStatus} />
              </div>

              <div className="hidden min-w-[8rem] whitespace-nowrap text-right text-[11px] text-gray-500 sm:block">
                {r.lastActivityAt ? formatRelative(r.lastActivityAt) : '—'}
              </div>

              <Link
                href={r.reviewHref}
                className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MaterialPill({ acked }: { acked: boolean | null }) {
  if (acked === null) {
    return (
      <span
        className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600"
        title="No material released this week"
      >
        material —
      </span>
    );
  }
  if (acked) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800"
        title="Material acknowledged"
      >
        <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
        material
      </span>
    );
  }
  return (
    <span
      className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
      title="Material released but not yet acknowledged by intern"
    >
      material · unread
    </span>
  );
}

function ReportPill({ status }: { status: ReportStatus | null }) {
  if (status == null) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
        report —
      </span>
    );
  }
  return (
    <span
      className={
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
        REPORT_PILL[status]
      }
    >
      report · {status}
    </span>
  );
}

function TimesheetPillBadge({ status }: { status: TimesheetStatus | null }) {
  if (status == null) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
        timesheet —
      </span>
    );
  }
  return (
    <span
      className={
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
        TIMESHEET_PILL[status]
      }
    >
      timesheet · {status}
    </span>
  );
}

// ── Upcoming ────────────────────────────────────────────────────────────────

function UpcomingCard({ items }: { items: SupervisorUpcoming[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Upcoming</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing on the schedule.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((u, i) => (
            <li key={`${u.type}-${i}`} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                {u.href ? (
                  <Link
                    href={u.href}
                    className="block truncate text-sm font-medium text-gray-900 hover:text-accent-dark hover:underline"
                  >
                    {u.title}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {u.title}
                  </span>
                )}
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

// ── Recent activity ─────────────────────────────────────────────────────────

function RecentActivityCard({ items }: { items: SupervisorActivity[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No recent activity from your interns.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((a, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-900">
                  {a.href ? (
                    <Link href={a.href} className="hover:underline">
                      {a.summary}
                    </Link>
                  ) : (
                    a.summary
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {a.timestamp ? formatRelative(a.timestamp) : '—'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="h-28 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
        <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      </div>
    </div>
  );
}
