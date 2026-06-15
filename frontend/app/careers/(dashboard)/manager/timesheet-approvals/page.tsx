'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronUp,
  Filter, Search, X,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type {
  TimesheetFilterOptions,
  TimesheetListResponse,
  TimesheetRow,
} from '@/components/manager/types';

export default function TimesheetApprovalsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <TimesheetApprovalsInner />
    </Suspense>
  );
}

function TimesheetApprovalsInner() {
  const { user } = useAuth();

  const [status, setStatus] = useState<string>('SUBMITTED');
  const [myInternsOnly, setMyInternsOnly] = useState<boolean>(false);
  const [technology, setTechnology] = useState<string>('');
  const [ermOwner, setErmOwner] = useState<string>('');
  const [weekStart, setWeekStart] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState(0);

  const [data, setData] = useState<TimesheetListResponse | null>(null);
  const [filters, setFilters] = useState<TimesheetFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [actionPending, setActionPending] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<TimesheetFilterOptions>(
          '/api/v1/manager/timesheets/filters');
        setFilters(res.data);
      } catch {
        // non-fatal
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (myInternsOnly && user?.userId) params.set('managerId', user.userId);
      if (technology) params.set('technology', technology);
      if (ermOwner) params.set('ermOwner', ermOwner);
      if (weekStart) params.set('weekStart', weekStart);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('pageSize', '25');
      const res = await api.get<TimesheetListResponse>(
        `/api/v1/manager/timesheets?${params.toString()}`);
      setData(res.data);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, [status, myInternsOnly, technology, ermOwner, weekStart, search, page,
      user?.userId]);
  useEffect(() => { void load(); }, [load]);

  function toggleExpanded(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function approve(row: TimesheetRow) {
    if (!row.canAct) return;
    setActionPending(row.timesheetId);
    setErr(null);
    try {
      await api.post(`/api/v1/manager/timesheets/${row.timesheetId}/approve`);
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setErr(ax.response?.data?.error
          ?? ax.response?.data?.message
          ?? ax.message ?? 'Approve failed');
    } finally {
      setActionPending(null);
    }
  }

  async function submitReject() {
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      setErr('Rejection reason is required.');
      return;
    }
    setActionPending(rejectingId);
    setErr(null);
    try {
      await api.post(`/api/v1/manager/timesheets/${rejectingId}/reject`,
        { reason: rejectReason.trim() });
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setErr(ax.response?.data?.error
          ?? ax.response?.data?.message
          ?? ax.message ?? 'Reject failed');
    } finally {
      setActionPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <p className="text-xs text-slate-500">
        <Link href="/careers/manager"
          className="inline-flex items-center gap-1 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" />
          Manager home
        </Link>
      </p>

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Timesheet Approvals</h1>
        <p className="text-xs text-slate-500">
          View portfolio-wide; act only on your direct reports
          (SUPER_ADMIN acts on all). Reject requires a reason. Hours +
          per-day detail are visible only on rows you can act on.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <label className="md:col-span-2 block">
            <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Search className="h-3 w-3" />
              Search intern (name / email / employee ID)
            </span>
            <input
              type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search…"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <FilterSelect label="Status" value={status}
            onChange={(v) => { setStatus(v); setPage(0); }}>
            {(filters?.statuses ?? ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'])
              .map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="ALL">All</option>
          </FilterSelect>
          <FilterSelect label="Technology" value={technology}
            onChange={(v) => { setTechnology(v); setPage(0); }}>
            <option value="">All</option>
            {filters?.technologies.map((t) =>
              <option key={t} value={t}>{t}</option>)}
          </FilterSelect>
          <FilterSelect label="ERM owner" value={ermOwner}
            onChange={(v) => { setErmOwner(v); setPage(0); }}>
            <option value="">All</option>
            {filters?.ermOwners.map((o) =>
              <option key={o.userId} value={o.userId}>{o.fullName}</option>)}
          </FilterSelect>
          <label className="block">
            <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Filter className="h-3 w-3" />
              Week start (yyyy-mm-dd)
            </span>
            <input
              type="date" value={weekStart}
              onChange={(e) => { setWeekStart(e.target.value); setPage(0); }}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className={
            'inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 text-sm ' +
            (myInternsOnly
              ? 'bg-teal-100 font-semibold text-teal-800 ring-1 ring-teal-300'
              : 'text-slate-700 hover:bg-slate-100')
          }>
            <input
              type="checkbox" checked={myInternsOnly}
              onChange={(e) => { setMyInternsOnly(e.target.checked); setPage(0); }}
              className="h-4 w-4 accent-teal-700"
            />
            My interns only
            {myInternsOnly && <span className="text-[10px] uppercase">(filter active)</span>}
          </label>
        </div>
      </section>

      {err && (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {err}
        </p>
      )}

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Intern</th>
              <th className="px-3 py-2 text-left">Manager</th>
              <th className="px-3 py-2 text-left">Week</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Approver</th>
              <th className="px-3 py-2 text-right">Hours</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">Loading…</td></tr>
            )}
            {data && data.items.length === 0 && !loading && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">
                No timesheets match these filters.
              </td></tr>
            )}
            {data?.items.map((r) => (
              <Row key={r.timesheetId} row={r}
                expanded={expanded.has(r.timesheetId)}
                onToggle={() => toggleExpanded(r.timesheetId)}
                onApprove={() => approve(r)}
                onReject={() => { setRejectingId(r.timesheetId); setRejectReason(''); }}
                actionPending={actionPending === r.timesheetId} />
            ))}
          </tbody>
        </table>
      </section>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <p>Page {data.page + 1} of {data.totalPages} · {data.totalElements} total</p>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-50">
              Prev
            </button>
            <button type="button" disabled={page + 1 >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      )}

      {rejectingId && (
        <RejectModal
          reason={rejectReason}
          setReason={setRejectReason}
          submitting={actionPending === rejectingId}
          onCancel={() => { setRejectingId(null); setRejectReason(''); }}
          onSubmit={() => void submitReject()}
        />
      )}
    </div>
  );
}

function Row({
  row, expanded, onToggle, onApprove, onReject, actionPending,
}: {
  row: TimesheetRow;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  actionPending: boolean;
}) {
  const isSubmitted = row.status === 'SUBMITTED';
  return (
    <>
      <tr className="align-top hover:bg-slate-50">
        <td className="px-3 py-2">
          <p className="font-medium text-slate-900">{row.internName ?? '—'}</p>
          <p className="text-[11px] text-slate-500">
            {row.employeeId ?? ''}{row.technology ? ` · ${row.technology}` : ''}
          </p>
        </td>
        <td className="px-3 py-2 text-[11px] text-slate-700">
          {row.managerName ?? <span className="text-amber-700">Unassigned</span>}
        </td>
        <td className="px-3 py-2 text-[11px] text-slate-700">
          {row.weekStart ?? '—'}
        </td>
        <td className="px-3 py-2">
          <StatusPill status={row.status} />
          {row.reviewNote && row.status === 'REJECTED' && (
            <p className="mt-1 max-w-[14rem] truncate text-[10px] text-rose-700"
              title={row.reviewNote}>
              reason: {row.reviewNote}
            </p>
          )}
        </td>
        <td className="px-3 py-2 text-[11px] text-slate-700">
          {row.approvedByName ?? <span className="text-slate-400">—</span>}
          {row.approvedAt && (
            <p className="text-[10px] text-slate-500">
              {new Date(row.approvedAt).toLocaleDateString()}
            </p>
          )}
        </td>
        <td className="px-3 py-2 text-right text-[11px] tabular-nums text-slate-900">
          {row.canAct
            ? (row.hours != null ? `${row.hours}` : '—')
            : <span className="text-slate-400" title="Hidden — not your intern">—</span>}
        </td>
        <td className="px-3 py-2 text-right">
          {row.canAct && isSubmitted ? (
            <div className="flex justify-end gap-1">
              <button type="button" onClick={onApprove} disabled={actionPending}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                <Check className="h-3 w-3" />
                Approve
              </button>
              <button type="button" onClick={onReject} disabled={actionPending}
                className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <X className="h-3 w-3" />
                Reject
              </button>
              <button type="button" onClick={onToggle}
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-1.5 py-1 text-slate-600 hover:bg-slate-50"
                title={expanded ? 'Hide detail' : 'Show detail'}>
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
          ) : row.canAct ? (
            <button type="button" onClick={onToggle}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              detail
            </button>
          ) : (
            <span className="text-[11px] text-slate-400" title="Read-only — not your intern">
              read-only
            </span>
          )}
        </td>
      </tr>
      {expanded && row.canAct && (
        <tr className="bg-slate-50">
          <td colSpan={7} className="px-3 py-3">
            <Detail row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ row }: { row: TimesheetRow }) {
  return (
    <div className="space-y-2">
      {row.description && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Intern&apos;s notes
          </p>
          <p className="whitespace-pre-wrap text-[12px] text-slate-700">
            {row.description}
          </p>
        </div>
      )}
      {row.days && row.days.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Daily breakdown
          </p>
          <table className="mt-1 min-w-full text-xs">
            <thead className="text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-2 py-1 text-left">Day</th>
                <th className="px-2 py-1 text-right">Hours</th>
                <th className="px-2 py-1 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {row.days.map((d) => (
                <tr key={d.dayOfWeek}>
                  <td className="px-2 py-1">{d.dayOfWeek}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{d.hours}</td>
                  <td className="px-2 py-1 text-slate-700">{d.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          No daily breakdown — weekly total only.
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: TimesheetRow['status'] }) {
  const tone = status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700'
    : status === 'SUBMITTED' ? 'bg-violet-100 text-violet-700'
    : status === 'REJECTED' ? 'bg-rose-100 text-rose-700'
    : 'bg-slate-100 text-slate-700';
  return (
    <span className={'rounded-full px-2 py-0.5 text-[10px] font-semibold ' + tone}>
      {status}
    </span>
  );
}

function FilterSelect({
  label, value, onChange, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <Filter className="h-3 w-3" />
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
        {children}
      </select>
    </label>
  );
}

function RejectModal({
  reason, setReason, submitting, onCancel, onSubmit,
}: {
  reason: string;
  setReason: (v: string) => void;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              Reject timesheet
            </h2>
            <p className="text-xs text-slate-500">
              The reason is shown to the intern. Be specific so they can correct
              and resubmit.
            </p>
          </div>
          <button type="button" onClick={onCancel}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-3 block">
          <span className="text-xs font-semibold text-slate-700">Reason</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="e.g. Daily breakdown doesn't match weekly total; please correct."
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={onSubmit}
            disabled={submitting || !reason.trim()}
            className="rounded-md bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            {submitting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
