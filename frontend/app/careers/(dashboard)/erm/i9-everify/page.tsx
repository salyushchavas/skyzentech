'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import StatCard from '@/components/preview/StatCard';
import I9StatusBadge from '@/components/i9/I9StatusBadge';
import EVerifyStatusBadge from '@/components/everify/EVerifyStatusBadge';
import EVerifyPhaseBadge from '@/components/everify/EVerifyPhaseBadge';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  EVerifyCaseSummaryResponse,
  EVerifyStatus,
  I9Status,
  I9SummaryResponse,
  Page,
} from '@/types';

type Filter = 'ALL' | I9Status;

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'NOT_STARTED', label: 'Not Started' },
  // Phase 3 step 5 — canonical "Section 1 done, Section 2 due" filter.
  // SECTION_1_COMPLETE is left out of the filter dropdown since it's a legacy
  // alias of the same logical state.
  { key: 'SECTION_2_PENDING', label: 'Section 2 Pending' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'REOPENED', label: 'Reopened' },
];

export default function HrI9EverifyPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM']}>
      <DashboardLayout title="I-9 & E-Verify">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [activeTab, setActiveTab] = useState<'i9' | 'everify'>('i9');

  // Hydrate active tab from URL hash on mount, and listen for hash changes
  // (so the in-page "Switch to I-9 tab" link works without a full refresh).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'everify' || h === 'i9') setActiveTab(h);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  function switchTab(next: 'i9' | 'everify') {
    setActiveTab(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#' + next);
    }
  }

  return (
    <>
      <div className="mb-6 flex gap-6 border-b border-gray-200">
        <TabBtn active={activeTab === 'i9'} onClick={() => switchTab('i9')}>
          I-9 Forms
        </TabBtn>
        <TabBtn
          active={activeTab === 'everify'}
          onClick={() => switchTab('everify')}
        >
          E-Verify Cases
        </TabBtn>
      </div>

      {activeTab === 'i9' && <I9TabContent />}
      {activeTab === 'everify' && (
        <EVerifyTabContent onSwitchToI9={() => switchTab('i9')} />
      )}
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        '-mb-px pb-3 text-sm font-medium transition-colors ' +
        (active
          ? 'border-b-2 border-accent text-accent'
          : 'text-gray-500 hover:text-gray-700')
      }
    >
      {children}
    </button>
  );
}

function I9TabContent() {
  const router = useRouter();
  const [rows, setRows] = useState<I9SummaryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Page<I9SummaryResponse>>('/api/v1/i9', {
        params: { size: 200 },
      });
      setRows(res.data?.content ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load I-9 forms.");
      setRows(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const stats = useMemo(() => {
    if (!rows) {
      return { pending: 0, overdue: 0, completedThisMonth: 0, total: 0 };
    }
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    let pending = 0;
    let overdue = 0;
    let completedThisMonth = 0;
    for (const r of rows) {
      if (
        r.status === 'NOT_STARTED'
        || r.status === 'SECTION_2_PENDING'
        || r.status === 'SECTION_1_COMPLETE'
      ) {
        pending++;
      }
      if (r.section2Overdue ?? r.overdue) overdue++;
      if (r.status === 'COMPLETED') {
        // Summary doesn't carry section2SignedAt — fall back to firstDayOfEmployment
        // as a reasonable proxy for "completed this month" (close enough for v1).
        const d = r.firstDayOfEmployment
          ? new Date(r.firstDayOfEmployment)
          : null;
        if (d && `${d.getFullYear()}-${d.getMonth()}` === monthKey) {
          completedThisMonth++;
        }
      }
    }
    return { pending, overdue, completedThisMonth, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (overdueOnly && !(r.section2Overdue ?? r.overdue)) return false;
      if (q) {
        const hay =
          (r.candidateName ?? '').toLowerCase() +
          ' ' +
          (r.candidateEmail ?? '').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, overdueOnly, search]);

  return (
    <>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending Action" value={stats.pending} icon={Clock} />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          icon={AlertTriangle}
        />
        <StatCard
          label="Completed (this month)"
          value={stats.completedThisMonth}
          icon={CheckCircle}
        />
        <StatCard label="Total" value={stats.total} icon={FileText} />
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
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
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-accent"
            />
            Show overdue only
          </label>
          <input
            type="search"
            placeholder="Search by candidate…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw
              className={
                'h-3.5 w-3.5 ' + (refreshing ? 'animate-spin' : '')
              }
              strokeWidth={2}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
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

      {/* Loading */}
      {rows === null && !error && <LoadingSkeleton />}

      {/* Empty */}
      {rows !== null && filtered.length === 0 && !error && (
        <EmptyState
          filter={filter}
          overdueOnly={overdueOnly}
          hasAnyRows={(rows?.length ?? 0) > 0}
        />
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">First Day</th>
                <th className="px-4 py-3">Section 2 Due</th>
                <th className="px-4 py-3">Days Remaining</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/careers/erm/i9-everify/i9/${r.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {r.candidateName ?? '(unnamed)'}
                    </div>
                    {r.candidateEmail && (
                      <div className="text-xs text-gray-500">
                        {r.candidateEmail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.jobPostingTitle ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <I9StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.firstDayOfEmployment
                      ? formatDateOnly(r.firstDayOfEmployment)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.section2DueDate ? formatDateOnly(r.section2DueDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <DaysRemainingCell row={r} />
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      href={`/careers/erm/i9-everify/i9/${r.id}`}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
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

function DaysRemainingCell({ row }: { row: I9SummaryResponse }) {
  if (row.status === 'COMPLETED' || row.section2DueDate == null) {
    return <span className="text-sm text-gray-500">—</span>;
  }
  const d = row.daysUntilDue;
  if (d == null) return <span className="text-sm text-gray-500">—</span>;
  if (row.section2Overdue ?? row.overdue) {
    return (
      <span className="text-sm font-medium text-red-700">
        Overdue by {Math.abs(d)}d
      </span>
    );
  }
  if (d <= 2) {
    return (
      <span className="text-sm font-medium text-amber-700">
        {d}d remaining
      </span>
    );
  }
  return <span className="text-sm text-gray-700">{d}d</span>;
}

function EmptyState({
  filter,
  overdueOnly,
  hasAnyRows,
}: {
  filter: Filter;
  overdueOnly: boolean;
  hasAnyRows: boolean;
}) {
  let msg = 'No I-9 forms found';
  if (!hasAnyRows) msg = 'No I-9 forms yet';
  else if (overdueOnly) msg = 'No overdue I-9s — all current ✓';
  else if (filter === 'NOT_STARTED') msg = 'No forms awaiting Section 1';
  else if (filter === 'SECTION_2_PENDING' || filter === 'SECTION_1_COMPLETE')
    msg = 'No forms awaiting Section 2';
  else if (filter === 'COMPLETED') msg = 'No completed I-9s';
  else if (filter === 'REOPENED') msg = 'No reopened forms';
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
      <p className="text-base font-medium text-gray-700">{msg}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="space-y-1 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
            <div className="ml-auto h-7 w-16 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── E-Verify tab ────────────────────────────────────────────────────────────

type EVerifyFilter = 'ALL' | 'PENDING_SUBMISSION' | 'OPEN' | 'TNC' | 'EMPLOYMENT_AUTHORIZED' | 'CLOSED';

const EVERIFY_FILTERS: { key: EVerifyFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING_SUBMISSION', label: 'Pending Submission' },
  { key: 'OPEN', label: 'Open' },
  { key: 'TNC', label: 'TNC' },
  { key: 'EMPLOYMENT_AUTHORIZED', label: 'Authorized' },
  { key: 'CLOSED', label: 'Closed' },
];

const MS_30_DAYS = 30 * 86_400_000;

function EVerifyTabContent({
  onSwitchToI9,
}: {
  onSwitchToI9: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EVerifyCaseSummaryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EVerifyFilter>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Page<EVerifyCaseSummaryResponse>>(
        '/api/v1/everify',
        { params: { size: 200 } }
      );
      setRows(res.data?.content ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load E-Verify cases.");
      setRows(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const stats = useMemo(() => {
    if (!rows) {
      return { pending: 0, open: 0, tnc: 0, closedRecent: 0 };
    }
    const now = Date.now();
    let pending = 0;
    let open = 0;
    let tnc = 0;
    let closedRecent = 0;
    for (const r of rows) {
      if (r.status === 'PENDING_SUBMISSION') pending++;
      else if (r.status === 'OPEN') open++;
      else if (
        r.status === 'TENTATIVE_NONCONFIRMATION' ||
        r.status === 'FINAL_NONCONFIRMATION'
      ) {
        tnc++;
      } else if (r.status === 'CLOSED' && r.closedAt) {
        if (now - new Date(r.closedAt).getTime() < MS_30_DAYS) closedRecent++;
      }
    }
    return { pending, open, tnc, closedRecent };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filter === 'ALL') return true;
      if (filter === 'TNC') {
        return (
          r.status === 'TENTATIVE_NONCONFIRMATION' ||
          r.status === 'FINAL_NONCONFIRMATION'
        );
      }
      return r.status === (filter as EVerifyStatus);
    });
  }, [rows, filter]);

  return (
    <>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending Submission"
          value={stats.pending}
          icon={Clock}
        />
        <StatCard label="Open Cases" value={stats.open} icon={Activity} />
        <StatCard
          label="TNC / Issues"
          value={stats.tnc}
          icon={AlertTriangle}
        />
        <StatCard
          label="Closed (30d)"
          value={stats.closedRecent}
          icon={CheckCircle}
        />
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {EVERIFY_FILTERS.map((opt) => {
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
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            className={'h-3.5 w-3.5 ' + (refreshing ? 'animate-spin' : '')}
            strokeWidth={2}
          />
          Refresh
        </button>
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
              ? 'No E-Verify cases yet'
              : 'No cases match this filter'}
          </p>
          {rows.length === 0 && (
            <>
              <p className="mt-2 text-sm text-gray-500">
                Cases are created from completed I-9 forms.
              </p>
              <button
                type="button"
                onClick={onSwitchToI9}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
              >
                View I-9 Forms
              </button>
            </>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Case Number</th>
                <th className="px-4 py-3">Phase</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due by</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3">Days Open</th>
                <th className="px-4 py-3">Last Activity</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() =>
                    router.push(`/careers/erm/i9-everify/everify/${r.id}`)
                  }
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {r.candidateName ?? '(unnamed)'}
                    </div>
                    {r.candidateEmail && (
                      <div className="text-xs text-gray-500">
                        {r.candidateEmail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.caseNumber ? (
                      <span className="font-mono text-gray-700">
                        {r.caseNumber}
                      </span>
                    ) : (
                      <span className="text-gray-400" title="Not yet submitted">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <EVerifyPhaseBadge phase={r.phase} />
                  </td>
                  <td className="px-4 py-3">
                    <EVerifyStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.dueBy ? (
                      <span
                        className={
                          r.overdue
                            ? 'font-medium text-red-700'
                            : 'text-gray-700'
                        }
                      >
                        {formatDateOnly(r.dueBy)}
                        {r.overdue && (
                          <span className="ml-1 text-[10px] uppercase tracking-wide">
                            Overdue
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.openedAt ? formatDateOnly(r.openedAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.daysOpen != null ? `${r.daysOpen}d` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatRelative(r.updatedAt)}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      href={`/careers/erm/i9-everify/everify/${r.id}`}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
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
