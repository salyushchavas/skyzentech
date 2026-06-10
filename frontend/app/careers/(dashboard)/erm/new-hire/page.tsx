'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import AssignPacketModal from '@/components/erm/documents/AssignPacketModal';
import type {
  NewHireListPage,
  NewHireRow,
} from '@/components/erm/offers/types';

// ERM Phase 8.2 — three-tab restructure. Default is the
// "Pending Document Assignment" view so the most common ERM action
// (assign documents to an intern whose structure is complete) is one
// click away. "In Progress" surfaces packets actively being filled/
// reviewed; "All Hires" keeps the original full list (now including
// the legacy reporting-structure pending bucket via the original
// `tab=pending` server param).
const TABS: { key: string; label: string; serverTab: string }[] = [
  { key: 'pending-document-assignment',
    label: 'Pending Document Assignment',
    serverTab: 'pending-document-assignment' },
  { key: 'in-progress',
    label: 'Documents In Progress',
    serverTab: 'in-progress' },
  { key: 'all', label: 'All Hires', serverTab: 'all' },
];

export default function NewHireListPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="New Hire List"
          subtitle="Signed offers — pick a tab to focus on a specific stage of onboarding."
        />
        <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-slate-100" />}>
          <NewHireListPageInner />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function NewHireListPageInner() {
  const sp = useSearchParams();
  const initialTab = sp?.get('tab') ?? 'pending-document-assignment';
  const [tab, setTab] = useState(
    TABS.some((t) => t.key === initialTab) ? initialTab : 'pending-document-assignment',
  );
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NewHireListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<NewHireRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const serverTab = TABS.find((t) => t.key === tab)?.serverTab ?? tab;
      const res = await api.get<NewHireListPage>(
        `/api/v1/erm/new-hire?tab=${serverTab}&page=${page}&pageSize=25`,
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
    <>
      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setPage(0); }}
            className={
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium ' +
              (tab === t.key
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-600 hover:text-slate-900')
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

      {tab === 'pending-document-assignment' ? (
        <PendingTable data={data} loading={loading}
          onAssign={(row) => setAssignFor(row)} />
      ) : tab === 'in-progress' ? (
        <InProgressTable data={data} loading={loading} />
      ) : (
        <AllHiresTable data={data} loading={loading} />
      )}

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

      {assignFor && (
        <AssignPacketModal
          open
          lifecycleId={assignFor.internLifecycleId}
          internName={assignFor.internName}
          employeeId={assignFor.employeeId}
          tentativeStartDate={assignFor.tentativeStartDate ?? undefined}
          reportingStructureComplete={assignFor.reportingStructureComplete}
          onClose={() => setAssignFor(null)}
          onAssigned={() => { setAssignFor(null); void load(); }}
        />
      )}
    </>
  );
}

function PendingTable({
  data, loading, onAssign,
}: {
  data: NewHireListPage | null;
  loading: boolean;
  onAssign: (row: NewHireRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {loading && !data ? (
        <div className="h-40 animate-pulse" />
      ) : !data || data.items.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-500">
          No interns are awaiting a document packet right now.
        </p>
      ) : (
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Intern</th>
              <th className="px-3 py-2">Tentative start</th>
              <th className="px-3 py-2">Hired</th>
              <th className="px-3 py-2">Reporting structure</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((r) => {
              const days = daysSince(r.signedAt);
              const urgent = days != null && days > 7;
              return (
                <tr key={r.internLifecycleId}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/careers/erm/new-hire/${r.internLifecycleId}`}
                      className="block text-sm font-medium text-slate-900 hover:underline"
                    >
                      {r.internName ?? '(unknown)'}
                    </Link>
                    <span className="block text-[11px] text-slate-500">
                      {r.employeeId} · {r.internEmail}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {r.tentativeStartDate ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.signedAt && (
                      <span className={urgent ? 'font-semibold text-rose-700' : 'text-slate-700'}>
                        {days}d ago {urgent && '· urgent'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StructurePills row={r} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onAssign(r)}
                      disabled={!r.reportingStructureComplete}
                      title={!r.reportingStructureComplete
                        ? 'Assign reporting structure first' : ''}
                      className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
                    >
                      Assign Documents
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function InProgressTable({
  data, loading,
}: { data: NewHireListPage | null; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {loading && !data ? (
        <div className="h-40 animate-pulse" />
      ) : !data || data.items.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-500">
          No document packets are actively in progress.
        </p>
      ) : (
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Intern</th>
              <th className="px-3 py-2">Tentative start</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((r) => (
              <tr key={r.internLifecycleId}>
                <td className="px-3 py-2">
                  <Link
                    href={`/careers/erm/new-hire/${r.internLifecycleId}`}
                    className="block text-sm font-medium text-slate-900 hover:underline"
                  >
                    {r.internName ?? '(unknown)'}
                  </Link>
                  <span className="block text-[11px] text-slate-500">
                    {r.employeeId} · {r.internEmail}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  {r.tentativeStartDate ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/careers/erm/document-packets?search=${encodeURIComponent(r.internName ?? '')}`}
                    className="rounded-md border border-teal-300 px-3 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                  >
                    Open packet →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AllHiresTable({
  data, loading,
}: { data: NewHireListPage | null; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {loading && !data ? (
        <div className="h-40 animate-pulse" />
      ) : !data || data.items.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-500">
          No new hires on file.
        </p>
      ) : (
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Tentative start</th>
              <th className="px-3 py-2">Reporting structure</th>
              <th className="px-3 py-2">Documents</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((r) => (
              <tr key={r.internLifecycleId}>
                <td className="px-3 py-2">
                  <Link
                    href={`/careers/erm/new-hire/${r.internLifecycleId}`}
                    className="hover:underline"
                  >
                    <span className="block text-sm font-medium text-slate-900">
                      {r.internName ?? '(unknown)'}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {r.employeeId} · {r.internEmail}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  {r.tentativeStartDate ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <StructurePills row={r} />
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.onboardingAssigned ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      Assigned
                    </span>
                  ) : (
                    <span className="text-slate-500">Not assigned</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/careers/erm/new-hire/${r.internLifecycleId}`}
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StructurePills({ row }: { row: NewHireRow }) {
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
  );
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
