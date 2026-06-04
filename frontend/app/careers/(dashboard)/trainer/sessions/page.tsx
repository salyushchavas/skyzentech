'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Star } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/lib/api';
import { formatFull } from '@/lib/format-date';
import type { Uuid } from '@/types';

type EvaluationStatus = 'SCHEDULED' | 'COMPLETED' | 'MISSED';

interface EvaluatorSessionResponse {
  sessionId: Uuid;
  candidateId: Uuid | null;
  internName: string | null;
  scheduledAt: string | null;
  status: EvaluationStatus;
  overallRating: number | null;
  completedAt: string | null;
}

const STATUS_COLOR: Record<EvaluationStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  MISSED: 'bg-gray-100 text-gray-700',
};

function StatusBadge({ status }: { status: EvaluationStatus }) {
  const labels: Record<EvaluationStatus, string> = {
    SCHEDULED: 'Scheduled',
    COMPLETED: 'Completed ✓',
    MISSED: 'Missed',
  };
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        STATUS_COLOR[status]
      }
    >
      {labels[status]}
    </span>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            (n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300') + ' h-4 w-4'
          }
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

export default function EvaluatorSessionsPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'TECHNICAL_EVALUATOR']}>
      <DashboardLayout title="Sessions">
        <SessionsList />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function SessionsList() {
  const [sessions, setSessions] = useState<EvaluatorSessionResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<EvaluatorSessionResponse[]>(
        '/api/v1/supervised/evaluator/sessions',
      );
      setSessions(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your sessions.");
      setSessions(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    if (!sessions) return { upcoming: [], past: [] };
    const now = Date.now();
    const up: EvaluatorSessionResponse[] = [];
    const ps: EvaluatorSessionResponse[] = [];
    for (const s of sessions) {
      const future =
        s.status === 'SCHEDULED' &&
        s.scheduledAt &&
        new Date(s.scheduledAt).getTime() >= now;
      if (future) up.push(s);
      else ps.push(s);
    }
    up.sort(
      (a, b) =>
        new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime(),
    );
    ps.sort(
      (a, b) =>
        new Date(b.scheduledAt ?? 0).getTime() - new Date(a.scheduledAt ?? 0).getTime(),
    );
    return { upcoming: up, past: ps };
  }, [sessions]);

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

  if (sessions === null) {
    return <div className="py-10 text-center text-sm text-gray-500">Loading…</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <CalendarClock className="mx-auto mb-3 h-8 w-8 text-gray-400" strokeWidth={1.5} />
        <p className="text-sm text-gray-600">No evaluation sessions yet.</p>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming sessions.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((s) => (
              <li
                key={s.sessionId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">
                    {s.scheduledAt ? formatFull(s.scheduledAt) : '—'}
                  </div>
                  <div className="text-sm text-gray-600">{s.internName ?? '—'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={s.status} />
                  {s.candidateId && (
                    <Link
                      href={`/careers/supervised/${s.candidateId}#evaluations`}
                      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
                    >
                      Record
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Past</h2>
        {past.length === 0 ? (
          <p className="text-sm text-gray-500">No past sessions.</p>
        ) : (
          <ul className="space-y-3">
            {past.map((s) => (
              <li
                key={s.sessionId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">
                    {s.scheduledAt ? formatFull(s.scheduledAt) : '—'}
                  </div>
                  <div className="text-sm text-gray-600">{s.internName ?? '—'}</div>
                </div>
                <div className="flex items-center gap-3">
                  {s.overallRating != null && <StarRow value={s.overallRating} />}
                  <StatusBadge status={s.status} />
                  {s.candidateId && (
                    <Link
                      href={`/careers/supervised/${s.candidateId}#evaluations`}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
