'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import type {
  NewHireListPage,
  NewHireRow,
} from '@/components/erm/offers/types';

const TABS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending reporting structure' },
  { key: 'ready', label: 'Ready for onboarding' },
  { key: 'all', label: 'All' },
];

export default function NewHireListPage() {
  const [tab, setTab] = useState('pending');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NewHireListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<NewHireListPage>(
        `/api/v1/erm/new-hire?tab=${tab}&page=${page}&pageSize=25`,
      );
      setData(res.data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load new hires');
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="New Hire List"
          subtitle="Signed offers awaiting onboarding setup."
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setPage(0); }}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium ' +
                (tab === t.key
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50')
              }
            >
              {t.label}
            </button>
          ))}
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
              No new hires match this tab.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Tentative start</th>
                  <th className="px-3 py-2">Reporting structure</th>
                  <th className="px-3 py-2">Onboarding</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => <Row key={r.internLifecycleId} row={r} />)}
              </tbody>
            </table>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Row({ row }: { row: NewHireRow }) {
  const dot = (filled: boolean, label: string) => (
    <span
      className={
        'inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ' +
        (filled
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-400')
      }
      title={label + (filled ? ' assigned' : ' empty')}
    >
      {label[0]}
    </span>
  );
  return (
    <tr>
      <td className="px-3 py-2">
        <Link
          href={`/careers/erm/new-hire/${row.internLifecycleId}`}
          className="hover:underline"
        >
          <span className="block text-sm font-medium text-slate-900">
            {row.internName ?? '(unknown)'}
          </span>
          <span className="block text-[11px] text-slate-500">
            {row.employeeId} · {row.internEmail}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        {row.tentativeStartDate ?? '—'}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {dot(!!row.trainerName, 'T')}
          {dot(!!row.evaluatorName, 'E')}
          {dot(!!row.managerName, 'M')}
          {row.reportingStructureComplete && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              Complete
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-xs">
        {row.onboardingAssigned ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            Assigned
          </span>
        ) : (
          <span className="text-slate-500">Not assigned</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <Link
          href={`/careers/erm/new-hire/${row.internLifecycleId}`}
          className="text-xs font-medium text-teal-700 hover:underline"
        >
          Open →
        </Link>
      </td>
    </tr>
  );
}
