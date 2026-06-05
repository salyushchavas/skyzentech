'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import OnboardingStatusPill from '@/components/erm/onboarding/OnboardingStatusPill';
import BulkReviewModal from '@/components/erm/onboarding/BulkReviewModal';
import {
  CATEGORY_LABEL,
  type ReviewQueuePage,
  type ReviewQueueRow,
} from '@/components/erm/onboarding/types';

const CATEGORY_TABS = [
  { key: '', label: 'All' },
  { key: 'W4', label: 'W-4' },
  { key: 'I9', label: 'I-9' },
  { key: 'ACH', label: 'ACH' },
  { key: 'EMERGENCY_CONTACT', label: 'Emergency' },
  { key: 'HANDBOOK_ACK', label: 'Handbook' },
  { key: 'I983', label: 'I-983' },
];

export default function OnboardingReviewQueuePage() {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ReviewQueuePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('pageSize', '25');
      const res = await api.get<ReviewQueuePage>(
        `/api/v1/erm/onboarding/review-queue?${params.toString()}`,
      );
      setData(res.data);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [category, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    if (selected.size === data.items.length && data.items.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((r) => r.itemId)));
    }
  }

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="Onboarding document review"
          subtitle="Accept, reject, or request resubmission for submitted onboarding items."
        />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {CATEGORY_TABS.map((c) => (
            <button
              key={c.key || 'all'}
              type="button"
              onClick={() => {
                setCategory(c.key);
                setPage(0);
                setSelected(new Set());
              }}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium ' +
                (category === c.key
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50')
              }
            >
              {c.label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(0);
                void load();
              }
            }}
            placeholder="Search applicant"
            className="ml-auto w-56 rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="mb-3 flex items-center gap-2">
          <Link
            href="/careers/erm/onboarding?view=packets"
            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            View packets →
          </Link>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setBulkOpen(true)}
            className="rounded-md bg-teal-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
          >
            Bulk accept ({selected.size})
          </button>
        </div>

        {err && (
          <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {err}
          </p>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {loading && !data ? (
            <div className="h-40 animate-pulse" />
          ) : !data || data.items.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">
              No submitted items waiting on you. Nice.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={
                        data.items.length > 0 &&
                        selected.size === data.items.length
                      }
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2">Applicant</th>
                  <th className="px-3 py-2">Document</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Waiting</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => (
                  <Row
                    key={r.itemId}
                    row={r}
                    checked={selected.has(r.itemId)}
                    onToggle={() => toggle(r.itemId)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {data.page + 1} of {data.totalPages} ({data.totalElements}{' '}
              total)
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={data.page + 1 >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {bulkOpen && (
          <BulkReviewModal
            itemIds={Array.from(selected)}
            onClose={() => setBulkOpen(false)}
            onDone={() => {
              setBulkOpen(false);
              setSelected(new Set());
              void load();
            }}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Row({
  row,
  checked,
  onToggle,
}: {
  row: ReviewQueueRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const waiting = row.daysWaiting ?? 0;
  const waitClass =
    waiting >= 3
      ? 'text-rose-700 font-semibold'
      : waiting >= 1
        ? 'text-amber-700'
        : 'text-slate-600';
  return (
    <tr>
      <td className="px-3 py-2">
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </td>
      <td className="px-3 py-2">
        <Link
          href={`/careers/erm/onboarding/items/${row.itemId}`}
          className="hover:underline"
        >
          <span className="block text-sm font-medium text-slate-900">
            {row.applicantName ?? '(unknown)'}
          </span>
          <span className="block text-[11px] text-slate-500">
            {row.applicantId ?? row.applicantEmail}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2">
        <span className="block text-sm text-slate-800">
          {CATEGORY_LABEL[row.category] ?? row.category}
        </span>
        <span className="block text-[11px] text-slate-500">
          {row.required ? 'Required' : 'Optional'}
          {row.reviewCount && row.reviewCount > 1
            ? ` · review #${row.reviewCount}`
            : ''}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        {row.submittedAt
          ? new Date(row.submittedAt).toLocaleDateString()
          : '—'}
      </td>
      <td className={'px-3 py-2 text-xs ' + waitClass}>
        {waiting} day{waiting === 1 ? '' : 's'}
      </td>
      <td className="px-3 py-2">
        <OnboardingStatusPill status={row.status} />
      </td>
    </tr>
  );
}
