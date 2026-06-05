'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import OfferStatusPill from '@/components/erm/offers/OfferStatusPill';
import type {
  OfferListPage,
  OfferRow,
  OfferStatus,
} from '@/components/erm/offers/types';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'SENT', label: 'Sent' },
  { key: 'SIGNED', label: 'Signed' },
  { key: 'VOIDED', label: 'Voided' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'DECLINED', label: 'Declined' },
];

export default function OfferControlPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<OfferListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('pageSize', '25');
      const res = await api.get<OfferListPage>(
        `/api/v1/erm/offers?${params.toString()}`,
      );
      setData(res.data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="Offers / DocuSign"
          subtitle="Create, track, void, and resend offer envelopes."
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((c) => (
            <button
              key={c.key || 'all'}
              type="button"
              onClick={() => { setStatus(c.key); setPage(0); }}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium ' +
                (status === c.key
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
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(0); void load(); } }}
            placeholder="Search applicant"
            className="ml-auto w-56 rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
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
              No offers match the current filters.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Applicant</th>
                  <th className="px-3 py-2">Role / Comp</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => <Row key={r.offerId} row={r} />)}
              </tbody>
            </table>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {data.page + 1} of {data.totalPages} ({data.totalElements} total)
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
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Row({ row }: { row: OfferRow }) {
  const expiresSoon =
    row.status === 'SENT' &&
    row.expiresAt &&
    new Date(row.expiresAt).getTime() - Date.now() < 24 * 3600 * 1000;
  return (
    <tr>
      <td className="px-3 py-2">
        <Link href={`/careers/erm/offers/${row.offerId}`} className="hover:underline">
          <span className="block text-sm font-medium text-slate-900">
            {row.applicantName ?? '(unknown)'}
          </span>
          <span className="block text-[11px] text-slate-500">{row.applicantId}</span>
        </Link>
      </td>
      <td className="px-3 py-2">
        <span className="block text-sm text-slate-800">{row.roleTitle ?? row.jobTitle}</span>
        <span className="block text-[11px] text-slate-500">{row.compensationSummary}</span>
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        {row.tentativeStartDate ?? '—'}
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        {row.sentAt ? new Date(row.sentAt).toLocaleDateString() : '—'}
      </td>
      <td className="px-3 py-2 text-xs">
        {row.expiresAt ? (
          <span className={expiresSoon ? 'rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700' : 'text-slate-700'}>
            {new Date(row.expiresAt).toLocaleDateString()}
          </span>
        ) : '—'}
        {row.reminderCount > 0 && (
          <span className="ml-1 text-[10px] text-slate-400">
            ({row.reminderCount} reminder{row.reminderCount === 1 ? '' : 's'})
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <OfferStatusPill status={row.status} />
        {row.archived && (
          <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
            archived
          </span>
        )}
      </td>
    </tr>
  );
}
