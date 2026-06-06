'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import StateBadge from '@/components/trainer/StateBadge';
import ProjectSlotIndicator from '@/components/trainer/ProjectSlotIndicator';
import type {
  ActiveInternListPage,
  ActiveInternRow,
} from '@/components/trainer/types';

const POLL_MS = 60_000;

const PROJECT_FILTERS = ['no_project', 'in_progress', 'overdue', 'completed'];
const MEETING_FILTERS = ['SCHEDULED', 'COMPLETED', 'MISSED', 'RESCHEDULED', 'NONE'];
const EVAL_FILTERS = ['SCHEDULED', 'COMPLETED', 'OVERDUE', 'NONE'];
const TS_FILTERS = ['SUBMITTED', 'APPROVED', 'REJECTED', 'MISSING'];

export default function ActiveInternsPage() {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [meetingFilter, setMeetingFilter] = useState<string[]>([]);
  const [evalFilter, setEvalFilter] = useState<string[]>([]);
  const [tsFilter, setTsFilter] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ActiveInternListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      projectFilter.forEach((s) => params.append('projectState', s));
      meetingFilter.forEach((s) => params.append('meetingState', s));
      evalFilter.forEach((s) => params.append('evaluationState', s));
      tsFilter.forEach((s) => params.append('timesheetState', s));
      params.set('page', String(page));
      params.set('pageSize', '25');
      const res = await api.get<ActiveInternListPage>(
        `/api/v1/trainer/active-interns?${params.toString()}`,
      );
      setData(res.data);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [search, projectFilter, meetingFilter, evalFilter, tsFilter, page]);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      void load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const anyFilter = useMemo(
    () =>
      search.trim().length > 0 ||
      projectFilter.length > 0 ||
      meetingFilter.length > 0 ||
      evalFilter.length > 0 ||
      tsFilter.length > 0,
    [search, projectFilter, meetingFilter, evalFilter, tsFilter],
  );

  function clearFilters() {
    setSearch('');
    setProjectFilter([]);
    setMeetingFilter([]);
    setEvalFilter([]);
    setTsFilter([]);
    setPage(0);
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    const path = `/api/v1/trainer/active-interns/export?${params.toString()}`;
    api
      .get<Blob>(path, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `active-interns-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e: any) =>
        alert(
          'CSV download failed: ' +
            (e?.response?.data?.error ?? e?.message ?? 'unknown'),
        ),
      );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Active Interns</h1>
        <p className="text-xs text-slate-500">
          Doc §5 view — scope: assigned to you.
        </p>
      </header>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(0);
              void load();
            }
          }}
          placeholder="Search name, email, employee ID"
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        />
        <FilterRow
          label="Projects"
          options={PROJECT_FILTERS}
          selected={projectFilter}
          onChange={(v) => {
            setProjectFilter(v);
            setPage(0);
          }}
          labelMap={{
            no_project: 'No project',
            in_progress: 'In progress',
            overdue: 'Overdue',
            completed: 'Completed',
          }}
        />
        <FilterRow
          label="Meeting"
          options={MEETING_FILTERS}
          selected={meetingFilter}
          onChange={(v) => {
            setMeetingFilter(v);
            setPage(0);
          }}
        />
        <FilterRow
          label="Evaluation"
          options={EVAL_FILTERS}
          selected={evalFilter}
          onChange={(v) => {
            setEvalFilter(v);
            setPage(0);
          }}
        />
        <FilterRow
          label="Timesheet"
          options={TS_FILTERS}
          selected={tsFilter}
          onChange={(v) => {
            setTsFilter(v);
            setPage(0);
          }}
        />
        <div className="flex items-center justify-between pt-1">
          {anyFilter ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] font-medium text-teal-700 hover:text-teal-900"
            >
              Clear filters
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-md border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      {err && (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {err}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && !data ? (
          <div className="h-48 animate-pulse" />
        ) : !data || data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            No active interns match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Employee ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone / Email</th>
                  <th className="px-3 py-2">Technology</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">Current month projects</th>
                  <th className="px-3 py-2">Meeting</th>
                  <th className="px-3 py-2">Evaluation</th>
                  <th className="px-3 py-2">Timesheet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => (
                  <Row key={r.internLifecycleId} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
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
    </div>
  );
}

function FilterRow({
  label,
  options,
  selected,
  onChange,
  labelMap,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  labelMap?: Record<string, string>;
}) {
  function toggle(o: string) {
    const next = selected.includes(o)
      ? selected.filter((s) => s !== o)
      : [...selected, o];
    onChange(next);
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase text-slate-500">
        {label}
      </span>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={
              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium ' +
              (on
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50')
            }
          >
            {labelMap?.[o] ?? o}
          </button>
        );
      })}
    </div>
  );
}

function Row({ row }: { row: ActiveInternRow }) {
  return (
    <tr>
      <td className="px-3 py-2 text-xs text-slate-700">
        {row.employeeId ?? '—'}
      </td>
      <td className="px-3 py-2">
        <Link
          href={`/careers/trainer/active-interns/${row.internLifecycleId}`}
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          {row.fullName ?? '(unknown)'}
        </Link>
        <span className="block text-[10px] text-slate-500">
          Trainer: {row.reportingStructure.trainerName ?? '—'}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        <span className="block">{row.phone ?? '—'}</span>
        <span className="block text-[10px] text-slate-500">
          {row.email ?? '—'}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
          {row.technologyTitle ?? '—'}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        {row.startDate ?? '—'}
        <span className="block text-[10px] text-slate-500">
          {row.daysActive}d active
        </span>
      </td>
      <td className="px-3 py-2">
        <ProjectSlotIndicator
          project1={row.currentMonthProjects.project1}
          project2={row.currentMonthProjects.project2}
          monthYear={row.currentMonthProjects.monthYear}
        />
      </td>
      <td className="px-3 py-2">
        <StateBadge state={row.weeklyMeeting.state} variant="meeting" />
      </td>
      <td className="px-3 py-2">
        <StateBadge state={row.evaluation.state} variant="evaluation" />
      </td>
      <td className="px-3 py-2">
        <StateBadge state={row.timesheet.state} variant="timesheet" />
      </td>
    </tr>
  );
}
