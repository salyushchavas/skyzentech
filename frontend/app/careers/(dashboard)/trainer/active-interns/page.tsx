'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileWarning,
  GraduationCap,
} from 'lucide-react';
import api from '@/lib/api';
import PeriodPicker, {
  formatPeriod,
  periodToMonthYear,
  usePeriodFromUrl,
} from '@/components/ui/PeriodPicker';
import type {
  ActiveInternListPage,
  ActiveInternRow,
  MonthRosterSummary,
  ProjectSlot,
} from '@/components/trainer/types';

const POLL_MS = 60_000;

type RowFilter = 'all' | 'attention' | 'no_project' | 'kt_missing' | 'ts_incomplete' | 'eval_overdue';

const FILTER_LABEL: Record<RowFilter, string> = {
  all: 'All',
  attention: 'Attention needed',
  no_project: 'No project',
  kt_missing: 'KT not done',
  ts_incomplete: 'Timesheets incomplete',
  eval_overdue: 'Evaluation overdue',
};

type SortKey = 'name' | 'project' | 'kt' | 'eval' | 'timesheet';

export default function ActiveInternsPage() {
  const [period, setPeriod] = usePeriodFromUrl();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RowFilter>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [data, setData] = useState<ActiveInternListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      params.set('y', String(period.year));
      params.set('m', String(period.month));
      params.set('page', '0');
      params.set('pageSize', '100');
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
  }, [search, period.year, period.month]);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const items = data.items.filter((r) => rowMatchesFilter(r, filter));
    items.sort(rowComparator(sort));
    return items;
  }, [data, filter, sort]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Monthly intern roster</h1>
          <p className="text-xs text-slate-500">
            {formatPeriod(period)} · all interns active that month
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </header>

      {data?.summary && (
        <SummaryStrip summary={data.summary} monthYear={data.monthYear} />
      )}

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void load(); }}
          placeholder="Search name, email, employee ID"
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-slate-500">Show</span>
          {(Object.keys(FILTER_LABEL) as RowFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium '
                + (filter === f
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50')
              }
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {err}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && !data ? (
          <div className="h-48 animate-pulse" aria-hidden />
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            {data && data.items.length === 0
              ? `No active interns in ${formatPeriod(period)}.`
              : 'No interns match the current filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <SortableHeader k="name" current={sort} onClick={setSort}>Name</SortableHeader>
                  <SortableHeader k="project" current={sort} onClick={setSort}>Project</SortableHeader>
                  <SortableHeader k="kt" current={sort} onClick={setSort}>KT</SortableHeader>
                  <SortableHeader k="eval" current={sort} onClick={setSort}>Training eval</SortableHeader>
                  <SortableHeader k="timesheet" current={sort} onClick={setSort}>Timesheets</SortableHeader>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <Row key={r.internLifecycleId} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Summary strip ────────────────────────────────────────────────────────

function SummaryStrip({
  summary, monthYear,
}: { summary: MonthRosterSummary; monthYear: string }) {
  const tiles: Array<{ label: string; value: number; tone: string }> = [
    { label: 'Active', value: summary.totalActive, tone: 'slate' },
    { label: 'Projects unassigned', value: summary.projectsUnassigned, tone: summary.projectsUnassigned > 0 ? 'amber' : 'slate' },
    { label: 'KT not done', value: summary.ktNotDone, tone: summary.ktNotDone > 0 ? 'amber' : 'slate' },
    { label: 'Timesheets incomplete', value: summary.timesheetsIncomplete, tone: summary.timesheetsIncomplete > 0 ? 'amber' : 'slate' },
    { label: 'Evaluations overdue', value: summary.evaluationsOverdue, tone: summary.evaluationsOverdue > 0 ? 'rose' : 'slate' },
    { label: 'Attention', value: summary.attentionNeeded, tone: summary.attentionNeeded > 0 ? 'rose' : 'emerald' },
  ];
  return (
    <section
      className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3 lg:grid-cols-6"
      aria-label={`Month summary for ${monthYear}`}
    >
      {tiles.map((t) => (
        <div key={t.label} className={'rounded-md p-2 ' + TONE_BG[t.tone]}>
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
            {t.label}
          </p>
          <p className={'mt-0.5 text-lg font-semibold ' + TONE_TEXT[t.tone]}>{t.value}</p>
        </div>
      ))}
    </section>
  );
}

const TONE_BG: Record<string, string> = {
  slate: 'bg-slate-50',
  amber: 'bg-amber-50',
  rose: 'bg-rose-50',
  emerald: 'bg-emerald-50',
};
const TONE_TEXT: Record<string, string> = {
  slate: 'text-slate-900',
  amber: 'text-amber-900',
  rose: 'text-rose-900',
  emerald: 'text-emerald-900',
};

// ── Row ──────────────────────────────────────────────────────────────────

function Row({ row }: { row: ActiveInternRow }) {
  const attention = rowAttention(row);
  return (
    <tr
      className={
        'transition-colors hover:bg-slate-50 '
        + (attention ? 'bg-rose-50/40 ring-1 ring-inset ring-rose-200/40' : '')
      }
    >
      <td className="px-3 py-2">
        <Link
          href={`/careers/trainer/active-interns/${row.internLifecycleId}`}
          className="block"
        >
          <span className="block text-sm font-medium text-slate-900 hover:underline">
            {row.fullName ?? '(unknown)'}
          </span>
          <span className="block text-[10px] text-slate-500">
            {row.employeeId ?? '—'}
            {row.technologyTitle ? ' · ' + row.technologyTitle : ''}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2"><ProjectCell row={row} /></td>
      <td className="px-3 py-2"><KtCell row={row} /></td>
      <td className="px-3 py-2"><EvalCell row={row} /></td>
      <td className="px-3 py-2"><TimesheetCell row={row} /></td>
      <td className="px-3 py-2 text-right">
        <Link
          href={`/careers/trainer/active-interns/${row.internLifecycleId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
        >
          Know more <ChevronRight className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}

// ── Cells ────────────────────────────────────────────────────────────────

function ProjectCell({ row }: { row: ActiveInternRow }) {
  const p1 = row.currentMonthProjects.project1;
  const p2 = row.currentMonthProjects.project2;
  if (!p1 && !p2) {
    return <Pill tone="slate">Not assigned</Pill>;
  }
  return (
    <div className="flex flex-col gap-1">
      {p1 && <SlotPill slot={p1} index={1} />}
      {p2 && <SlotPill slot={p2} index={2} />}
    </div>
  );
}

function SlotPill({ slot, index }: { slot: ProjectSlot; index: number }) {
  const tone =
    slot.state === 'COMPLETED' ? 'emerald'
    : slot.state === 'OVERDUE' ? 'rose'
    : slot.state === 'IN_PROGRESS' ? 'amber'
    : slot.state === 'ASSIGNED' ? 'sky'
    : 'slate';
  const label =
    slot.state === 'COMPLETED' ? 'Completed'
    : slot.state === 'OVERDUE' ? 'Overdue'
    : slot.state === 'IN_PROGRESS' ? humanProjectStatus(slot.status)
    : slot.state === 'ASSIGNED' ? 'Assigned'
    : 'Not started';
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono text-slate-400">P{index}</span>
      <Pill tone={tone}>{label}</Pill>
    </div>
  );
}

function humanProjectStatus(status: string | null): string {
  switch (status) {
    case 'SUBMITTED': return 'Submitted';
    case 'RETURNED':  return 'Returned';
    case 'IN_PROGRESS': return 'In progress';
    default: return 'In progress';
  }
}

function KtCell({ row }: { row: ActiveInternRow }) {
  const slots = [row.currentMonthProjects.project1, row.currentMonthProjects.project2].filter(Boolean) as ProjectSlot[];
  if (slots.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {slots.map((s, i) => {
        const done = s.ktStatus === 'DONE';
        return (
          <div key={s.id ?? i} className="flex items-center gap-1.5">
            {slots.length > 1 && (
              <span className="text-[10px] font-mono text-slate-400">P{i + 1}</span>
            )}
            <Pill tone={done ? 'emerald' : 'slate'}>
              {done
                ? <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Done</span>
                : 'Not done'}
            </Pill>
            {done && s.ktCompletedAt && (
              <span className="text-[10px] text-slate-500">
                {new Date(s.ktCompletedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EvalCell({ row }: { row: ActiveInternRow }) {
  const s = row.evaluation.state;
  if (s === 'NONE') {
    return <span className="text-xs text-slate-400" title="Available after a project completes">—</span>;
  }
  if (s === 'COMPLETED') {
    return (
      <Pill tone="emerald">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Done
        </span>
      </Pill>
    );
  }
  if (s === 'OVERDUE') {
    return (
      <Pill tone="rose">
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Not done
        </span>
      </Pill>
    );
  }
  return <Pill tone="amber">{s}</Pill>;
}

function TimesheetCell({ row }: { row: ActiveInternRow }) {
  const s = row.timesheet.state;
  const summary = row.timesheet.currentWeekStatus;
  const tone =
    s === 'APPROVED' ? 'emerald'
    : s === 'REJECTED' ? 'rose'
    : s === 'SUBMITTED' ? 'amber'
    : 'slate';
  const label =
    s === 'APPROVED' ? 'All approved'
    : s === 'REJECTED' ? 'Some rejected'
    : s === 'SUBMITTED' ? 'Pending review'
    : 'Missing';
  return (
    <div className="flex flex-col gap-0.5">
      <Pill tone={tone}>
        {s === 'REJECTED' && (
          <FileWarning className="mr-1 inline h-3 w-3" />
        )}
        {label}
      </Pill>
      {summary && <span className="text-[10px] text-slate-500">{summary}</span>}
    </div>
  );
}

// ── Primitives ───────────────────────────────────────────────────────────

function Pill({
  tone, children,
}: { tone: 'emerald' | 'amber' | 'rose' | 'sky' | 'slate'; children: React.ReactNode }) {
  const tones: Record<typeof tone, string> = {
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amber:   'bg-amber-50  text-amber-800  ring-amber-200',
    rose:    'bg-rose-50   text-rose-800   ring-rose-200',
    sky:     'bg-sky-50    text-sky-800    ring-sky-200',
    slate:   'bg-slate-100 text-slate-700  ring-slate-200',
  };
  return (
    <span className={
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset '
      + tones[tone]
    }>
      {children}
    </span>
  );
}

function SortableHeader({
  k, current, onClick, children,
}: { k: SortKey; current: SortKey; onClick: (k: SortKey) => void; children: React.ReactNode }) {
  const active = current === k;
  return (
    <th className="px-3 py-2">
      <button
        type="button"
        onClick={() => onClick(k)}
        className={'inline-flex items-center gap-1 ' + (active ? 'text-slate-900' : 'hover:text-slate-700')}
      >
        {children}
        {active && <span aria-hidden>↓</span>}
      </button>
    </th>
  );
}

// ── Row helpers ──────────────────────────────────────────────────────────

function rowAttention(r: ActiveInternRow): boolean {
  const p = r.currentMonthProjects;
  if (p.overallState === 'NO_PROJECTS') return true;
  const ktMissing =
    (p.project1 && p.project1.ktStatus !== 'DONE')
    || (p.project2 && p.project2.ktStatus !== 'DONE');
  if (ktMissing) return true;
  if (r.timesheet.state === 'REJECTED' || r.timesheet.state === 'MISSING') return true;
  if (r.evaluation.state === 'OVERDUE') return true;
  return false;
}

function rowMatchesFilter(r: ActiveInternRow, f: RowFilter): boolean {
  switch (f) {
    case 'all':         return true;
    case 'attention':   return rowAttention(r);
    case 'no_project':  return r.currentMonthProjects.overallState === 'NO_PROJECTS';
    case 'kt_missing': {
      const p = r.currentMonthProjects;
      return Boolean(
        (p.project1 && p.project1.ktStatus !== 'DONE')
        || (p.project2 && p.project2.ktStatus !== 'DONE'),
      );
    }
    case 'ts_incomplete': return r.timesheet.state !== 'APPROVED';
    case 'eval_overdue':  return r.evaluation.state === 'OVERDUE';
  }
}

function rowComparator(s: SortKey): (a: ActiveInternRow, b: ActiveInternRow) => number {
  const byName = (a: ActiveInternRow, b: ActiveInternRow) =>
    (a.fullName ?? '').localeCompare(b.fullName ?? '');
  switch (s) {
    case 'name':     return byName;
    case 'project':  return (a, b) =>
      (a.currentMonthProjects.overallState ?? '').localeCompare(b.currentMonthProjects.overallState ?? '')
      || byName(a, b);
    case 'kt':       return (a, b) => ktOrder(a) - ktOrder(b) || byName(a, b);
    case 'eval':     return (a, b) =>
      (a.evaluation.state ?? '').localeCompare(b.evaluation.state ?? '') || byName(a, b);
    case 'timesheet': return (a, b) =>
      (a.timesheet.state ?? '').localeCompare(b.timesheet.state ?? '') || byName(a, b);
  }
}

function ktOrder(r: ActiveInternRow): number {
  const slots = [r.currentMonthProjects.project1, r.currentMonthProjects.project2]
    .filter(Boolean) as ProjectSlot[];
  if (slots.length === 0) return 3;
  if (slots.every((s) => s.ktStatus === 'DONE')) return 0;
  if (slots.some((s) => s.ktStatus === 'DONE')) return 1;
  return 2;
}

// Suppress unused warning for the imported helper; consumers can use it.
void periodToMonthYear;
