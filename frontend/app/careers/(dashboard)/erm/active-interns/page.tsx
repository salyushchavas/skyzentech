'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import StateDot from '@/components/erm/active/StateDot';
import type {
  ActiveInternListPage,
  ActiveInternRow,
} from '@/components/erm/active/types';

const STATE_TABS = [
  { key: '', label: 'All' },
  { key: 'URGENT', label: 'Any URGENT' },
  { key: 'WARN', label: 'Any WARN' },
  { key: 'OK', label: 'All OK' },
];

const POLL_MS = 60_000;

export default function ActiveInternsPage() {
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [stateFilter, setStateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ActiveInternListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('scope', scope);
      if (stateFilter) params.set('state', stateFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('pageSize', '25');
      const res = await api.get<ActiveInternListPage>(
        `/api/v1/erm/active-interns?${params.toString()}`,
      );
      setData(res.data);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scope, stateFilter, search, page]);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      void load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="Active interns"
          subtitle="6 monitor cards per intern. Updated by the 15-min scan job + 60s polling."
        />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ScopeToggle scope={scope} onChange={setScope} />
          <span className="ml-2 text-[11px] uppercase text-slate-400">State</span>
          {STATE_TABS.map((c) => (
            <button
              key={c.key || 'all'}
              type="button"
              onClick={() => {
                setStateFilter(c.key);
                setPage(0);
              }}
              className={
                'rounded-full border px-2.5 py-0.5 text-xs font-medium ' +
                (stateFilter === c.key
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
            placeholder="Search intern"
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
              No active interns match the current filters.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Intern</th>
                  <th className="px-3 py-2">T / E / M</th>
                  <th className="px-3 py-2">Days</th>
                  <th className="px-3 py-2" colSpan={6}>
                    Monitor (Project · Mtg · Eval · TS · Compl · Esc)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => <Row key={r.internLifecycleId} row={r} />)}
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

function ScopeToggle({
  scope,
  onChange,
}: {
  scope: 'all' | 'mine';
  onChange: (s: 'all' | 'mine') => void;
}) {
  return (
    <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-0.5">
      {(['mine', 'all'] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={
            'rounded px-2 py-0.5 text-xs font-medium ' +
            (scope === s
              ? 'bg-slate-900 text-white'
              : 'text-slate-700 hover:bg-slate-50')
          }
        >
          {s === 'mine' ? 'Mine' : 'All'}
        </button>
      ))}
    </div>
  );
}

function Row({ row }: { row: ActiveInternRow }) {
  return (
    <tr>
      <td className="px-3 py-2">
        <Link
          href={`/careers/erm/active-interns/${row.internLifecycleId}`}
          className="hover:underline"
        >
          <span className="block text-sm font-medium text-slate-900">
            {row.internName ?? '(unknown)'}
          </span>
          <span className="block text-[11px] text-slate-500">
            {row.employeeId}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 text-[11px] text-slate-600">
        T: {row.trainerName ?? '—'}
        <br />
        E: {row.evaluatorName ?? '—'}
        <br />
        M: {row.managerName ?? '—'}
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">{row.daysActive}d</td>
      <td className="px-3 py-2">
        <StateDot state={row.project} label="Proj" />
      </td>
      <td className="px-3 py-2">
        <StateDot state={row.trainerMeeting} label="Mtg" />
      </td>
      <td className="px-3 py-2">
        <StateDot state={row.evaluation} label="Eval" />
      </td>
      <td className="px-3 py-2">
        <StateDot state={row.timesheet} label="TS" />
      </td>
      <td className="px-3 py-2">
        <StateDot state={row.compliance} label="Compl" />
      </td>
      <td className="px-3 py-2">
        <StateDot
          state={row.escalations}
          label={
            row.openExceptionCount > 0
              ? row.openExceptionCount + ' open'
              : 'Esc'
          }
        />
      </td>
    </tr>
  );
}
