'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle, BadgeCheck, ChevronLeft, ClipboardList, Filter,
  GraduationCap, Search, ShieldAlert, Users,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type {
  ActiveInternFilterOptions,
  ActiveInternResponse,
  ActiveInternRow,
  ActiveInternSummary,
  EvaluationState,
  MeetingState,
  ProjectState,
  TimesheetState,
} from '@/components/manager/types';

export default function ActiveInternsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <ActiveInternsInner />
    </Suspense>
  );
}

function ActiveInternsInner() {
  const sp = useSearchParams();
  const initialHealth = sp?.get('health') ?? '';
  const { user } = useAuth();

  const [technology, setTechnology] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [evaluatorId, setEvaluatorId] = useState('');
  const [ermOwner, setErmOwner] = useState('');
  const [myInternsOnly, setMyInternsOnly] = useState(false);
  const [health, setHealth] = useState<string>(initialHealth);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [data, setData] = useState<ActiveInternResponse | null>(null);
  const [filters, setFilters] = useState<ActiveInternFilterOptions | null>(null);
  const [summary, setSummary] = useState<ActiveInternSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [f, s] = await Promise.all([
          api.get<ActiveInternFilterOptions>('/api/v1/manager/active-interns/filters'),
          api.get<ActiveInternSummary>('/api/v1/manager/active-interns/summary'),
        ]);
        setFilters(f.data);
        setSummary(s.data);
      } catch {
        // non-fatal — list still renders
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (technology) params.set('technology', technology);
      if (trainerId) params.set('trainerId', trainerId);
      if (evaluatorId) params.set('evaluatorId', evaluatorId);
      if (ermOwner) params.set('ermOwner', ermOwner);
      if (myInternsOnly && user?.userId) params.set('managerId', user.userId);
      if (health) params.set('health', health);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('pageSize', '25');
      const res = await api.get<ActiveInternResponse>(
        `/api/v1/manager/active-interns?${params.toString()}`,
      );
      setData(res.data);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to load active interns');
    } finally {
      setLoading(false);
    }
  }, [technology, trainerId, evaluatorId, ermOwner, myInternsOnly,
      health, search, page, user?.userId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <p className="text-xs text-slate-500">
        <Link
          href="/careers/manager"
          className="inline-flex items-center gap-1 hover:text-slate-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Manager home
        </Link>
      </p>

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Active Interns</h1>
        <p className="text-xs text-slate-500">
          Portfolio-wide health view — project, weekly meeting, monthly
          evaluation, and weekly timesheet status per intern. Read-only;
          managerId is an owner column + optional filter, not an access fence.
          Thresholds match ERM: meeting missing &gt; 7d, evaluation overdue &gt;
          35d, timesheet missing for the previous week.
        </p>
      </header>

      {summary && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <SummaryCard icon={<Users className="h-4 w-4" />}
            label="Active interns" value={summary.activeInternsTotal} />
          <SummaryCard icon={<BadgeCheck className="h-4 w-4" />}
            label="On track" value={summary.onTrack} tone="emerald" />
          <SummaryCard icon={<ShieldAlert className="h-4 w-4" />}
            label="At risk" value={summary.atRisk}
            tone={summary.atRisk > 0 ? 'rose' : 'slate'} />
          <SummaryCard icon={<ClipboardList className="h-4 w-4" />}
            label="No project" value={summary.noProjectAssigned}
            tone={summary.noProjectAssigned > 0 ? 'amber' : 'slate'} />
          <SummaryCard icon={<AlertTriangle className="h-4 w-4" />}
            label="Meeting missing" value={summary.trainerMeetingMissing}
            tone={summary.trainerMeetingMissing > 0 ? 'amber' : 'slate'} />
          <SummaryCard icon={<GraduationCap className="h-4 w-4" />}
            label="Eval overdue" value={summary.evaluationOverdue}
            tone={summary.evaluationOverdue > 0 ? 'amber' : 'slate'} />
          <SummaryCard icon={<ClipboardList className="h-4 w-4" />}
            label="Timesheet missing"
            value={summary.timesheetMissingThisWeek}
            tone={summary.timesheetMissingThisWeek > 0 ? 'amber' : 'slate'} />
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <label className="md:col-span-2 block">
            <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Search className="h-3 w-3" />
              Search name / email / employee ID
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search…"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <FilterSelect label="Technology" value={technology}
            onChange={(v) => { setTechnology(v); setPage(0); }}>
            <option value="">All</option>
            {filters?.technologies.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Trainer" value={trainerId}
            onChange={(v) => { setTrainerId(v); setPage(0); }}>
            <option value="">All</option>
            {filters?.trainers.map((u) => (
              <option key={u.userId} value={u.userId}>{u.fullName}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Evaluator" value={evaluatorId}
            onChange={(v) => { setEvaluatorId(v); setPage(0); }}>
            <option value="">All</option>
            {filters?.evaluators.map((u) => (
              <option key={u.userId} value={u.userId}>{u.fullName}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="ERM owner" value={ermOwner}
            onChange={(v) => { setErmOwner(v); setPage(0); }}>
            <option value="">All</option>
            {filters?.ermOwners.map((u) => (
              <option key={u.userId} value={u.userId}>{u.fullName}</option>
            ))}
          </FilterSelect>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className={
            'inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 text-sm ' +
            (myInternsOnly
              ? 'bg-teal-100 font-semibold text-teal-800 ring-1 ring-teal-300'
              : 'text-slate-700 hover:bg-slate-100')
          }>
            <input
              type="checkbox"
              checked={myInternsOnly}
              onChange={(e) => { setMyInternsOnly(e.target.checked); setPage(0); }}
              className="h-4 w-4 accent-teal-700"
            />
            My interns only
            {myInternsOnly && <span className="text-[10px] uppercase">(filter active)</span>}
          </label>

          <div className="inline-flex items-center gap-1 text-sm text-slate-700">
            <Filter className="h-3 w-3" />
            Health:
            <PillButton active={health === ''} onClick={() => { setHealth(''); setPage(0); }}>
              All
            </PillButton>
            <PillButton active={health === 'ACTIVE_ON_TRACK'}
              onClick={() => { setHealth('ACTIVE_ON_TRACK'); setPage(0); }} tone="emerald">
              On track
            </PillButton>
            <PillButton active={health === 'ACTIVE_AT_RISK'}
              onClick={() => { setHealth('ACTIVE_AT_RISK'); setPage(0); }} tone="rose">
              At risk
            </PillButton>
          </div>
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
              <th className="px-3 py-2 text-left">Owner / Trainer / Evaluator</th>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Meeting</th>
              <th className="px-3 py-2 text-left">Evaluation</th>
              <th className="px-3 py-2 text-left">Timesheet</th>
              <th className="px-3 py-2 text-left">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">Loading…</td></tr>
            )}
            {data && data.items.length === 0 && !loading && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">
                No active interns match these filters.
              </td></tr>
            )}
            {data?.items.map((r) => <Row key={r.internLifecycleId} row={r} />)}
          </tbody>
        </table>
      </section>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <p>
            Page {data.page + 1} of {data.totalPages} · {data.totalElements} total
          </p>
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
    </div>
  );
}

function Row({ row }: { row: ActiveInternRow }) {
  return (
    <tr className="align-top hover:bg-slate-50">
      <td className="px-3 py-2">
        <p className="font-medium text-slate-900">{row.internName ?? '—'}</p>
        <p className="text-[11px] text-slate-500">
          {row.employeeId ?? ''}{row.technology ? ` · ${row.technology}` : ''}
        </p>
        {row.monthsInProgram != null && (
          <p className="text-[10px] text-slate-400">
            {row.monthsInProgram}mo in program
          </p>
        )}
      </td>
      <td className="px-3 py-2 text-[11px] text-slate-700">
        <OwnerRow label="Mgr" name={row.managerName} />
        <OwnerRow label="Trn" name={row.trainerName} />
        <OwnerRow label="Eva" name={row.evaluatorName} />
        <OwnerRow label="ERM" name={row.ermOwnerName} />
      </td>
      <td className="px-3 py-2"><ProjectCell s={row.project} /></td>
      <td className="px-3 py-2"><MeetingCell s={row.meeting} /></td>
      <td className="px-3 py-2"><EvaluationCell s={row.evaluation} /></td>
      <td className="px-3 py-2"><TimesheetCell s={row.timesheet} /></td>
      <td className="px-3 py-2">
        {row.health === 'ACTIVE_ON_TRACK' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <BadgeCheck className="h-3 w-3" />
            On track
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
            <AlertTriangle className="h-3 w-3" />
            At risk
          </span>
        )}
      </td>
    </tr>
  );
}

function OwnerRow({ label, name }: { label: string; name: string | null }) {
  return (
    <p className="leading-tight">
      <span className="text-[10px] font-semibold uppercase text-slate-400">{label}</span>{' '}
      {name ?? <span className="text-amber-700">Unassigned</span>}
    </p>
  );
}

function ProjectCell({ s }: { s: ProjectState }) {
  if (s.status == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
        <AlertTriangle className="h-3 w-3" />
        No active project
      </span>
    );
  }
  return (
    <div>
      <Pill tone={s.atRisk ? 'rose' : 'slate'}>
        {s.status.replaceAll('_', ' ')}
      </Pill>
      {s.projectTitle && (
        <p className="mt-1 max-w-[14rem] truncate text-[10px] text-slate-600"
          title={s.projectTitle}>
          {s.projectTitle}
        </p>
      )}
      {s.dueDate && (
        <p className={
          'text-[10px] ' + (s.atRisk ? 'text-rose-700 font-semibold' : 'text-slate-500')
        }>
          due {s.dueDate}{s.atRisk && ' · past due'}
        </p>
      )}
    </div>
  );
}

function MeetingCell({ s }: { s: MeetingState }) {
  if (s.lastMeetingStatus == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
        <AlertTriangle className="h-3 w-3" />
        Never
      </span>
    );
  }
  return (
    <div className="text-[11px]">
      <Pill tone={s.atRisk ? 'rose' : 'slate'}>
        {s.lastMeetingStatus.replaceAll('_', ' ')}
      </Pill>
      {s.daysSinceLastMeeting != null && (
        <p className={
          'mt-1 text-[10px] ' + (s.atRisk ? 'text-rose-700 font-semibold' : 'text-slate-500')
        }>
          {s.daysSinceLastMeeting}d ago{s.atRisk && ' · stale'}
        </p>
      )}
    </div>
  );
}

function EvaluationCell({ s }: { s: EvaluationState }) {
  if (s.lastEvaluationStatus == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
        <AlertTriangle className="h-3 w-3" />
        Never
      </span>
    );
  }
  return (
    <div className="text-[11px]">
      <Pill tone={s.atRisk ? 'rose' : 'emerald'}>
        {s.lastEvaluationStatus.replaceAll('_', ' ')}
      </Pill>
      {s.overallScore != null && (
        <p className="mt-1 text-[10px] text-slate-700">
          {s.overallScore} / 5{s.recommendation && ` · ${s.recommendation.replaceAll('_', ' ')}`}
        </p>
      )}
      {s.daysSinceLastPublished != null && (
        <p className={
          'text-[10px] ' + (s.atRisk ? 'text-rose-700 font-semibold' : 'text-slate-500')
        }>
          {s.daysSinceLastPublished}d ago{s.atRisk && ' · overdue'}
        </p>
      )}
    </div>
  );
}

function TimesheetCell({ s }: { s: TimesheetState }) {
  return (
    <div className="space-y-1 text-[11px]">
      <div className="flex flex-wrap gap-1">
        <span className="text-[10px] text-slate-500">this</span>
        <Pill tone={pillToneForTimesheet(s.currentWeekStatus)}>
          {s.currentWeekStatus ? s.currentWeekStatus.replaceAll('_', ' ') : 'NONE'}
        </Pill>
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="text-[10px] text-slate-500">prev</span>
        <Pill tone={pillToneForTimesheet(s.previousWeekStatus)}>
          {s.previousWeekStatus ? s.previousWeekStatus.replaceAll('_', ' ') : 'MISSING'}
        </Pill>
      </div>
      {s.recentRejections >= 2 && (
        <p className="text-[10px] font-semibold text-rose-700">
          {s.recentRejections} rejections / 4wk
        </p>
      )}
    </div>
  );
}

function pillToneForTimesheet(status: string | null): 'emerald' | 'violet' | 'slate' | 'rose' | 'amber' {
  switch (status) {
    case 'APPROVED': return 'emerald';
    case 'SUBMITTED': return 'violet';
    case 'REJECTED': return 'rose';
    case 'DRAFT': return 'slate';
    default: return 'amber';
  }
}

function Pill({
  tone, children,
}: {
  tone: 'emerald' | 'violet' | 'slate' | 'rose' | 'amber';
  children: React.ReactNode;
}) {
  const map = {
    emerald: 'bg-emerald-100 text-emerald-700',
    violet: 'bg-violet-100 text-violet-700',
    slate: 'bg-slate-100 text-slate-700',
    rose: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={'rounded-full px-1.5 py-0.5 text-[10px] font-semibold ' + map[tone]}>
      {children}
    </span>
  );
}

function PillButton({
  active, onClick, tone = 'slate', children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: 'emerald' | 'rose' | 'slate';
  children: React.ReactNode;
}) {
  const activeMap = {
    emerald: 'bg-emerald-600 text-white',
    rose: 'bg-rose-600 text-white',
    slate: 'bg-slate-700 text-white',
  };
  return (
    <button type="button" onClick={onClick}
      className={
        'rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
        (active ? activeMap[tone] : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
      }>
      {children}
    </button>
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      >
        {children}
      </select>
    </label>
  );
}

function SummaryCard({
  icon, label, value, tone = 'slate',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose';
}) {
  const cls = tone === 'emerald' ? 'text-emerald-700'
    : tone === 'amber' ? 'text-amber-700'
    : tone === 'rose' ? 'text-rose-700'
    : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}
