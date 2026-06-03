'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatRelative } from '@/lib/format-date';
import type { ReportingManagerDashboard } from '@/types';

type TabKey = 'qa' | 'timesheets' | 'all';

export default function ReportingManagerDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['REPORTING_MANAGER', 'SUPER_ADMIN']}>
      <DashboardLayout title="Reporting Manager">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [data, setData] = useState<ReportingManagerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('qa');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ReportingManagerDashboard>(
        '/api/v1/reporting-manager/dashboard',
      );
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signOffsDue = useMemo(
    () =>
      data?.qaInProgress?.filter((s) => s.status === 'CONDUCTED').length ?? 0,
    [data],
  );

  if (loading) return <Skeleton />;
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!data) return null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Reporting Manager</h1>
        <p className="mt-1 text-sm text-gray-600">
          What needs your attention right now — Q&amp;A sessions, timesheets, and
          sign-offs.
        </p>
      </header>

      {/* Queue cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QueueCard
          icon={<CalendarClock className="h-5 w-5" />}
          tone="indigo"
          label="Projects awaiting Q&A"
          value={data.pendingQaCount}
          hint="Tech-approved projects ready for a viva."
          ctaLabel="Open queue"
          onClick={() => setTab('qa')}
        />
        <QueueCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="amber"
          label="Timesheets pending review"
          value={data.pendingTimesheetCount}
          hint="Submitted weeks awaiting approval."
          ctaLabel="Open queue"
          onClick={() => setTab('timesheets')}
        />
        <QueueCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="violet"
          label="Sign-offs due this week"
          value={signOffsDue}
          hint="Conducted sessions awaiting final sign-off."
          ctaLabel="Open queue"
          onClick={() => setTab('qa')}
        />
      </div>

      {/* Tabs */}
      <nav
        className="flex flex-wrap items-center gap-1 border-b border-slate-200"
        role="tablist"
        aria-label="Reporting manager queues"
      >
        <TabButton active={tab === 'qa'} onClick={() => setTab('qa')}>
          Q&amp;A Queue ({data.projectsAwaitingQa.length + data.qaInProgress.length})
        </TabButton>
        <TabButton active={tab === 'timesheets'} onClick={() => setTab('timesheets')}>
          Timesheets ({data.pendingTimesheets.length})
        </TabButton>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          All Assignments
        </TabButton>
      </nav>

      {tab === 'qa' && <QaQueue data={data} />}
      {tab === 'timesheets' && <TimesheetQueue data={data} />}
      {tab === 'all' && <AllAssignments data={data} />}
    </section>
  );
}

function QaQueue({ data }: { data: ReportingManagerDashboard }) {
  const empty = data.projectsAwaitingQa.length === 0 && data.qaInProgress.length === 0;
  if (empty) {
    return <EmptyState>No Q&amp;A items right now.</EmptyState>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.projectsAwaitingQa.map((p) => (
        <article
          key={p.projectId}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-accent/40 hover:shadow-md"
        >
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5">Tech approved</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{p.projectTitle}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {p.internName ?? '—'}
            {p.techApprovedAt && <> · approved {formatRelative(p.techApprovedAt)}</>}
          </p>
          <Link
            href={`/careers/reporting-manager/sessions/new?projectId=${p.projectId}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
            Schedule Q&amp;A
          </Link>
        </article>
      ))}
      {data.qaInProgress.map((s) => (
        <article
          key={s.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-accent/40 hover:shadow-md"
        >
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
            <span
              className={
                'rounded-full px-2 py-0.5 ' +
                (s.status === 'CONDUCTED'
                  ? 'bg-violet-100 text-violet-800'
                  : 'bg-sky-100 text-sky-800')
              }
            >
              {s.status === 'CONDUCTED' ? 'Conducted' : 'Scheduled'}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{s.projectTitle ?? 'Session'}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {s.internName ?? '—'} · {formatRelative(s.scheduledAt)}
          </p>
          <Link
            href={`/careers/reporting-manager/sessions/${s.id}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {s.status === 'CONDUCTED' ? 'Conduct sign-off' : 'Conduct Q&A'}
          </Link>
        </article>
      ))}
    </div>
  );
}

function TimesheetQueue({ data }: { data: ReportingManagerDashboard }) {
  if (data.pendingTimesheets.length === 0) {
    return <EmptyState>No timesheets awaiting your review.</EmptyState>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.pendingTimesheets.map((t) => (
        <article
          key={t.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-accent/40 hover:shadow-md"
        >
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            <span className="rounded-full bg-amber-100 px-2 py-0.5">Submitted</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{t.internName ?? '—'}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Week of {t.weekStart} · {Number(t.totalHours).toFixed(1)} hrs
            {t.submittedAt && <> · submitted {formatRelative(t.submittedAt)}</>}
          </p>
          <Link
            href={`/careers/reporting-manager/timesheets/${t.id}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          >
            <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
            Review
          </Link>
        </article>
      ))}
    </div>
  );
}

function AllAssignments({ data }: { data: ReportingManagerDashboard }) {
  const empty =
    data.projectsAwaitingQa.length === 0
    && data.qaInProgress.length === 0
    && data.pendingTimesheets.length === 0;
  if (empty) {
    return (
      <EmptyState>
        <Users className="mx-auto mb-2 h-5 w-5 text-slate-400" strokeWidth={2} />
        Nothing queued up. New assignments will appear here.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      <QaQueue data={data} />
      <TimesheetQueue data={data} />
    </div>
  );
}

function QueueCard({
  icon,
  tone,
  label,
  value,
  hint,
  ctaLabel,
  onClick,
}: {
  icon: React.ReactNode;
  tone: 'indigo' | 'amber' | 'violet';
  label: string;
  value: number;
  hint: string;
  ctaLabel: string;
  onClick: () => void;
}) {
  const toneWrap =
    tone === 'indigo'
      ? 'border-indigo-200 bg-indigo-50/50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/50'
        : 'border-violet-200 bg-violet-50/50';
  const toneIcon =
    tone === 'indigo'
      ? 'bg-indigo-100 text-indigo-700'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-violet-100 text-violet-700';
  return (
    <div className={'rounded-xl border p-4 shadow-sm ' + toneWrap}>
      <div className="flex items-start justify-between gap-3">
        <div className={'flex h-9 w-9 items-center justify-center rounded-full ' + toneIcon}>
          {icon}
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-xs text-slate-600">{hint}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
      >
        {ctaLabel} →
      </button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        '-mb-px border-b-2 px-3 py-2 text-sm font-medium ' +
        (active
          ? 'border-accent text-accent-dark'
          : 'border-transparent text-slate-600 hover:text-slate-900')
      }
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-1/3 animate-pulse rounded bg-gray-100" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      </div>
      <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
