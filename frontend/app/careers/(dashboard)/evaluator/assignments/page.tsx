'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/lib/api';
import { formatDateOnly } from '@/lib/format-date';
import type { Uuid } from '@/types';

type AssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVIEWED';

interface EvaluatorAssignmentResponse {
  assignmentId: Uuid;
  candidateId: Uuid | null;
  internName: string | null;
  title: string;
  status: AssignmentStatus;
  dueDate: string | null;
  submittedAt: string | null;
}

const STATUS_COLOR: Record<AssignmentStatus, string> = {
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  SUBMITTED: 'bg-purple-100 text-purple-800',
  REVIEWED: 'bg-emerald-100 text-emerald-800',
};

function StatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        STATUS_COLOR[status]
      }
    >
      {status === 'REVIEWED' ? 'Reviewed ✓' : status.replace('_', ' ')}
    </span>
  );
}

const STATUS_OPTIONS: { value: 'ALL' | AssignmentStatus; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'REVIEWED', label: 'Reviewed' },
];

export default function EvaluatorAssignmentsPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_EVALUATOR', 'ADMIN']}>
      <DashboardLayout title="Assignments">
        <Suspense fallback={<div className="py-10 text-center text-sm text-gray-500">Loading…</div>}>
          <AssignmentsList />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function AssignmentsList() {
  const searchParams = useSearchParams();
  const initialStatus = (() => {
    const raw = searchParams.get('status');
    if (raw && (STATUS_OPTIONS.some((o) => o.value === raw))) {
      return raw as 'ALL' | AssignmentStatus;
    }
    return 'ALL';
  })();

  const [statusFilter, setStatusFilter] = useState<'ALL' | AssignmentStatus>(initialStatus);
  const [assignments, setAssignments] = useState<EvaluatorAssignmentResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await api.get<EvaluatorAssignmentResponse[]>(
        '/api/v1/supervised/evaluator/assignments',
        { params },
      );
      setAssignments(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your assignments.");
      setAssignments(null);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const submittedCount = useMemo(
    () => (assignments ?? []).filter((a) => a.status === 'SUBMITTED').length,
    [assignments],
  );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {assignments === null
            ? 'Loading assignments…'
            : `${assignments.length} assignment${assignments.length === 1 ? '' : 's'} for your interns` +
              (submittedCount > 0 ? ` · ${submittedCount} awaiting review` : '')}
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Status:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | AssignmentStatus)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

      {assignments === null && !error ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
      ) : (assignments?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-8 w-8 text-gray-400" strokeWidth={1.5} />
          <p className="text-sm text-gray-600">
            {statusFilter === 'ALL'
              ? 'No assignments yet for your interns.'
              : 'No assignments match that filter.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(assignments ?? []).map((a) => (
            <li
              key={a.assignmentId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0">
                <div className="font-semibold text-gray-900">{a.title}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {a.internName ?? '—'}
                  {a.dueDate ? <> · Due {formatDateOnly(a.dueDate)}</> : null}
                  {a.submittedAt ? <> · Submitted {formatDateOnly(a.submittedAt)}</> : null}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={a.status} />
                {a.candidateId && a.status === 'SUBMITTED' && (
                  <Link
                    href={`/careers/supervised/${a.candidateId}#assignments`}
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
                  >
                    Review
                  </Link>
                )}
                {a.candidateId && a.status !== 'SUBMITTED' && (
                  <Link
                    href={`/careers/supervised/${a.candidateId}#assignments`}
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
    </section>
  );
}
