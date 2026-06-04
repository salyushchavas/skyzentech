'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import InterviewStatusBadge from '@/components/interviews/InterviewStatusBadge';
import { formatRelative, isPast } from '@/lib/format-date';
import type {
  InterviewResponse,
  InterviewSummaryResponse,
  Page,
  UserRole,
} from '@/types';

const READ_ROLES: UserRole[] = [
  'OPERATIONS',
  'OPERATIONS',
  'OPERATIONS',
  'HR',
  'TECHNICAL_EVALUATOR',
];
const WRITE_ROLES: UserRole[] = ['OPERATIONS'];

type Tab = 'upcoming' | 'past' | 'all';

const TYPE_LABEL: Record<string, string> = {
  INITIAL_SCREEN: 'Initial Screen',
  TECHNICAL: 'Technical',
  BEHAVIORAL: 'Behavioral',
  CULTURE_FIT: 'Culture Fit',
  FINAL_ROUND: 'Final Round',
};

export default function ErmInterviewsPage() {
  return (
    <ProtectedRoute requiredRoles={READ_ROLES}>
      <DashboardLayout title="Interviews">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const { user } = useAuth();
  const canWrite = useMemo(
    () => user?.roles?.some((r) => WRITE_ROLES.includes(r)) ?? false,
    [user]
  );

  const [tab, setTab] = useState<Tab>('upcoming');
  const [rows, setRows] = useState<InterviewSummaryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Page<InterviewSummaryResponse>>(
        '/api/v1/interviews',
        { params: { size: 100 } }
      );
      setRows(res.data?.content ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Couldn't load interviews.";
      setError(msg);
      setRows(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (tab === 'all') return rows;
    if (tab === 'upcoming') return rows.filter((r) => !isPast(r.scheduledAt));
    return rows.filter((r) => isPast(r.scheduledAt));
  }, [rows, tab]);

  async function cancelInterview(id: string) {
    if (typeof window === 'undefined') return;
    if (!window.confirm('Cancel this interview? This cannot be undone.')) return;

    setCancellingId(id);
    try {
      await api.patch<InterviewResponse>(`/api/v1/interviews/${id}/status`, {
        status: 'CANCELLED',
      });
      toast.success('Interview cancelled');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not cancel interview');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <TabPills value={tab} onChange={setTab} />
        {canWrite && (
          <Link
            href="/careers/operations/interviews/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Schedule Interview
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {rows === null && !error && <LoadingSkeleton />}

      {rows !== null && filtered.length === 0 && !error && (
        <EmptyState tab={tab} canWrite={canWrite} />
      )}

      {filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white md:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Interviewer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {r.candidateName ?? '(unnamed)'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {r.jobPostingTitle ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatRelative(r.scheduledAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {r.interviewerName ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <InterviewStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/careers/operations/interviews/${r.id}`}
                          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
                        >
                          {r.status === 'SCHEDULED' ? 'View / Feedback' : 'View'}
                        </Link>
                        {canWrite && r.status === 'SCHEDULED' && (
                          <button
                            type="button"
                            onClick={() => void cancelInterview(r.id)}
                            disabled={cancellingId === r.id}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                          >
                            {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900">
                      {r.candidateName ?? '(unnamed)'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.jobPostingTitle ?? '—'}
                    </div>
                  </div>
                  <InterviewStatusBadge status={r.status} />
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="inline-block rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                    {TYPE_LABEL[r.type] ?? r.type}
                  </span>
                  <span>{formatRelative(r.scheduledAt)}</span>
                  <span>· {r.interviewerName ?? '—'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/careers/operations/interviews/${r.id}`}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
                  >
                    {r.status === 'SCHEDULED' ? 'View / Feedback' : 'View'}
                  </Link>
                  {canWrite && r.status === 'SCHEDULED' && (
                    <button
                      type="button"
                      onClick={() => void cancelInterview(r.id)}
                      disabled={cancellingId === r.id}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TabPills({ value, onChange }: { value: Tab; onChange: (v: Tab) => void }) {
  const opts: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
  ];
  return (
    <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={
            'rounded px-3 py-1 text-xs font-medium transition-colors ' +
            (value === o.key
              ? 'bg-accent text-white'
              : 'text-gray-600 hover:bg-gray-100')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="space-y-1 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
            <div className="ml-auto h-7 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ tab, canWrite }: { tab: Tab; canWrite: boolean }) {
  const label =
    tab === 'upcoming'
      ? 'No upcoming interviews'
      : tab === 'past'
        ? 'No past interviews'
        : 'No interviews yet';
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
      <p className="mb-4 text-base font-medium text-gray-700">{label}</p>
      {canWrite && (
        <Link
          href="/careers/operations/interviews/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Schedule the first one
        </Link>
      )}
    </div>
  );
}
