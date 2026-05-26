'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Plus,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import StatCard from '@/components/preview/StatCard';
import I983StatusBadge from '@/components/i983/I983StatusBadge';
import DsoStatusBadge from '@/components/i983/DsoStatusBadge';
import { formatRelative } from '@/lib/format-date';
import type { I983Status, I983SummaryResponse, Page } from '@/types';

type Filter = 'ALL' | I983Status;

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'COMPLETE', label: 'Complete' },
  { key: 'SUBMITTED_TO_DSO', label: 'Submitted to DSO' },
  { key: 'DSO_APPROVED', label: 'DSO Approved' },
  { key: 'DSO_REJECTED', label: 'DSO Rejected' },
  { key: 'AMENDMENT_REQUESTED', label: 'Amendment Requested' },
];

export default function ErmTrainingPlansPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'HR_COMPLIANCE']}>
      <DashboardLayout title="I-983 Training Plans">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const router = useRouter();
  const [rows, setRows] = useState<I983SummaryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Page<I983SummaryResponse>>('/api/v1/i983', {
        params: { size: 200 },
      });
      setRows(res.data?.content ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load training plans.");
      setRows(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (!rows) {
      return { total: 0, pendingDso: 0, approved: 0, amendment: 0 };
    }
    let pendingDso = 0;
    let approved = 0;
    let amendment = 0;
    for (const r of rows) {
      if (r.status === 'COMPLETE') pendingDso++;
      else if (r.status === 'DSO_APPROVED') approved++;
      else if (r.status === 'AMENDMENT_REQUESTED') amendment++;
    }
    return { total: rows.length, pendingDso, approved, amendment };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (q) {
        const hay = (r.candidateName ?? '').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Search by candidate…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Link
          href="/careers/erm/training-plans/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          New Training Plan
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Plans" value={stats.total} icon={FileText} />
        <StatCard
          label="Pending DSO Submission"
          value={stats.pendingDso}
          icon={Clock}
        />
        <StatCard
          label="Approved by DSO"
          value={stats.approved}
          icon={CheckCircle}
        />
        <StatCard
          label="Needs Amendment"
          value={stats.amendment}
          icon={AlertTriangle}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              className={
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
                (active
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
              }
            >
              {opt.label}
            </button>
          );
        })}
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
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-700">
            {rows.length === 0
              ? 'No training plans yet'
              : 'No plans match this filter'}
          </p>
          {rows.length === 0 && (
            <Link
              href="/careers/erm/training-plans/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Create first plan
            </Link>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Employer</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">DSO</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() =>
                    router.push(`/careers/erm/training-plans/${r.id}`)
                  }
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.candidateName ?? '(unnamed)'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.jobTitle ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.entityName ? (
                      <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {r.entityName}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <I983StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.employerSigned ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.studentSigned ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DsoStatusBadge status={r.dsoApprovalStatus} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatRelative(r.updatedAt)}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      href={`/careers/erm/training-plans/${r.id}`}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
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
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="ml-auto h-7 w-16 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
