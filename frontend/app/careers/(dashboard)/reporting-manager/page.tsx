'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatRelative } from '@/lib/format-date';
import type { ReportingManagerDashboard } from '@/types';

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
        <h1 className="text-2xl font-semibold text-gray-900">
          Reporting Manager
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Run vivas on tech-approved projects, sign off final completion, and
          approve your interns&apos; timesheets.
        </p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<CalendarClock className="h-5 w-5 text-indigo-600" />}
          label="Pending Q&As"
          value={data.pendingQaCount}
          hint="Projects awaiting a viva."
        />
        <StatCard
          icon={<ClipboardCheck className="h-5 w-5 text-amber-600" />}
          label="Pending timesheets"
          value={data.pendingTimesheetCount}
          hint="Submitted weeks awaiting approval."
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Completed this month"
          value={data.completedThisMonthCount}
          hint="Projects you signed off in this calendar month."
        />
      </div>

      {/* Projects awaiting Q&A */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Projects awaiting Q&amp;A
        </h2>
        {data.projectsAwaitingQa.length === 0 ? (
          <EmptyRow>No tech-approved projects pending Q&amp;A right now.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {data.projectsAwaitingQa.map((p) => (
              <li
                key={p.projectId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {p.projectTitle}
                  </div>
                  <div className="text-xs text-gray-500">
                    {p.internName ?? '—'}
                    {p.techApprovedAt && (
                      <> · tech-approved {formatRelative(p.techApprovedAt)}</>
                    )}
                  </div>
                </div>
                <Link
                  href={`/careers/reporting-manager/sessions/new?projectId=${p.projectId}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
                  Schedule Q&amp;A
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Q&A in progress */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Q&amp;A sessions in progress
        </h2>
        {data.qaInProgress.length === 0 ? (
          <EmptyRow>No active sessions.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {data.qaInProgress.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {s.projectTitle ?? 'Session'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.internName ?? '—'} · scheduled{' '}
                    {formatRelative(s.scheduledAt)} ·{' '}
                    <span
                      className={
                        s.status === 'CONDUCTED'
                          ? 'text-violet-700'
                          : 'text-indigo-700'
                      }
                    >
                      {s.status === 'CONDUCTED' ? 'Conducted' : 'Scheduled'}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/careers/reporting-manager/sessions/${s.id}`}
                  className="text-xs font-medium text-accent-dark hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pending timesheets (top 5) */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Pending timesheet approvals
          </h2>
          {data.pendingTimesheetCount > 5 && (
            <Link
              href="/careers/reporting-manager/timesheets"
              className="text-xs font-medium text-accent-dark hover:underline"
            >
              See all →
            </Link>
          )}
        </div>
        {data.pendingTimesheets.length === 0 ? (
          <EmptyRow>No timesheets awaiting your review.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {data.pendingTimesheets.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {t.internName ?? '—'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Week of {t.weekStart} · {Number(t.totalHours).toFixed(1)} hrs
                  </div>
                </div>
                <Link
                  href={`/careers/reporting-manager/timesheets/${t.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{hint}</div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-center text-xs italic text-gray-500">
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
