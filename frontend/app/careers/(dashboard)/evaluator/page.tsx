'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ClipboardList, Star, Users, type LucideIcon } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/lib/api';
import { formatDateOnly, formatFull } from '@/lib/format-date';
import { useAuth } from '@/lib/auth-context';
import type { Uuid } from '@/types';

interface EvaluatorInternResponse {
  candidateId: Uuid;
  name: string | null;
  position: string | null;
  entityName: string | null;
}

type EvaluationStatus = 'SCHEDULED' | 'COMPLETED' | 'MISSED';
type AssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVIEWED';

interface EvaluatorSessionResponse {
  sessionId: Uuid;
  candidateId: Uuid | null;
  internName: string | null;
  scheduledAt: string | null;
  status: EvaluationStatus;
  overallRating: number | null;
  completedAt: string | null;
}

interface EvaluatorAssignmentResponse {
  assignmentId: Uuid;
  candidateId: Uuid | null;
  internName: string | null;
  title: string;
  status: AssignmentStatus;
  dueDate: string | null;
  submittedAt: string | null;
}

interface EvaluatorDashboardResponse {
  internsCount: number;
  upcomingSessionsCount: number;
  pendingReviewsCount: number;
  averageRating: number | string | null;
  myInterns: EvaluatorInternResponse[] | null;
  upcomingSessions: EvaluatorSessionResponse[] | null;
  pendingReviews: EvaluatorAssignmentResponse[] | null;
}

export default function EvaluatorDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'TECHNICAL_SUPERVISOR']}>
      <DashboardLayout title="Evaluator Dashboard">
        <EvaluatorBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
          style={{ width: size, height: size }}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

function EvaluatorBody() {
  const { user } = useAuth();
  const [data, setData] = useState<EvaluatorDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<EvaluatorDashboardResponse>(
        '/api/v1/supervised/evaluator/dashboard',
      );
      setData(res.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your evaluator dashboard.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const avgDisplay = (() => {
    const raw = data?.averageRating;
    if (raw === null || raw === undefined) return '—';
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isNaN(n)) return '—';
    return `${n.toFixed(1)} / 5`;
  })();

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-gray-900">
          Welcome{user ? `, ${user.fullName}` : ''}.
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Your assigned interns, sessions, and pending reviews at a glance.
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="My interns"
          value={data === null ? '—' : String(data.internsCount ?? 0)}
          icon={Users}
        />
        <StatCard
          label="Upcoming sessions"
          value={data === null ? '—' : String(data.upcomingSessionsCount ?? 0)}
          icon={CalendarClock}
        />
        <StatCard
          label="Pending reviews"
          value={data === null ? '—' : String(data.pendingReviewsCount ?? 0)}
          icon={ClipboardList}
        />
        <StatCard
          label="Average rating"
          value={data === null ? '—' : avgDisplay}
          icon={Star}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="My interns" emptyText="No assigned interns yet." viewAllHref="/careers/evaluator/interns">
          {data === null ? (
            <Loading />
          ) : (data.myInterns?.length ?? 0) === 0 ? null : (
            <ul className="divide-y divide-gray-100">
              {(data.myInterns ?? []).map((i) => (
                <li key={i.candidateId} className="flex items-center gap-3 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                    {initialsOf(i.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/careers/supervised/${i.candidateId}`}
                      className="block truncate text-sm font-medium text-gray-900 hover:underline"
                    >
                      {i.name ?? '—'}
                    </Link>
                    <div className="truncate text-xs text-gray-500">
                      {i.position ?? '—'}
                      {i.entityName ? <> · {i.entityName}</> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Upcoming sessions"
          emptyText="No upcoming sessions."
          viewAllHref="/careers/evaluator/sessions"
        >
          {data === null ? (
            <Loading />
          ) : (data.upcomingSessions?.length ?? 0) === 0 ? null : (
            <ul className="divide-y divide-gray-100">
              {(data.upcomingSessions ?? []).map((s) => (
                <li key={s.sessionId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {s.internName ?? '—'}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {s.scheduledAt ? formatFull(s.scheduledAt) : '—'}
                    </div>
                  </div>
                  {s.candidateId && (
                    <Link
                      href={`/careers/supervised/${s.candidateId}#evaluations`}
                      className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Record
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Pending reviews"
          emptyText="No submissions awaiting review."
          viewAllHref="/careers/evaluator/assignments?status=SUBMITTED"
        >
          {data === null ? (
            <Loading />
          ) : (data.pendingReviews?.length ?? 0) === 0 ? null : (
            <ul className="divide-y divide-gray-100">
              {(data.pendingReviews ?? []).map((a) => (
                <li key={a.assignmentId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{a.title}</div>
                    <div className="truncate text-xs text-gray-500">
                      {a.internName ?? '—'}
                      {a.submittedAt ? <> · Submitted {formatDateOnly(a.submittedAt)}</> : null}
                    </div>
                  </div>
                  {a.candidateId && (
                    <Link
                      href={`/careers/supervised/${a.candidateId}#assignments`}
                      className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Review
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

function Loading() {
  return <div className="py-6 text-center text-sm text-gray-500">Loading…</div>;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
        <Icon className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
      </div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Panel({
  title,
  emptyText,
  viewAllHref,
  children,
}: {
  title: string;
  emptyText: string;
  viewAllHref: string;
  children: React.ReactNode;
}) {
  const empty =
    children === null ||
    children === undefined ||
    (Array.isArray(children) && children.length === 0);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <Link href={viewAllHref} className="text-xs font-medium text-accent hover:underline">
          View all
        </Link>
      </div>
      {empty ? <p className="text-sm text-gray-500">{emptyText}</p> : children}
    </div>
  );
}
