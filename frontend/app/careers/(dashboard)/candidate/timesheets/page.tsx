'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import type {
  DayOfWeek,
  TimesheetDayCell,
  TimesheetStatus,
  TimesheetWeek,
} from '@/types';

const DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const DAY_LABEL: Record<DayOfWeek, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

const PATCH_DEBOUNCE_MS = 800;
const HIGH_HOURS = 10;

export default function CandidateTimesheetPage() {
  return (
    <ProtectedRoute requiredRoles={['INTERN', 'APPLICANT', 'SUPER_ADMIN']}>
      <DashboardLayout title="Timesheets">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [weekStart, setWeekStart] = useState(() => isoMonday(new Date()));
  const [week, setWeek] = useState<TimesheetWeek | null>(null);
  const [draft, setDraft] = useState<Record<DayOfWeek, TimesheetDayCell>>(emptyDays());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dirtyRef = useRef<Record<DayOfWeek, boolean>>({} as Record<DayOfWeek, boolean>);
  const patchTimers = useRef<Partial<Record<DayOfWeek, ReturnType<typeof setTimeout>>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<TimesheetWeek>(
        `/api/v1/timesheets/week?weekStart=${weekStart}`,
      );
      setWeek(res.data);
      setDraft(mergeDays(res.data.days));
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load this week.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  // Clear any pending timers when the week changes so we don't write the
  // previous week's cells onto the new one.
  useEffect(() => {
    return () => {
      Object.values(patchTimers.current).forEach((t) => t && clearTimeout(t));
      patchTimers.current = {};
      dirtyRef.current = {} as Record<DayOfWeek, boolean>;
    };
  }, [weekStart]);

  const editable =
    week !== null && (week.status === 'DRAFT' || week.status === 'REJECTED');

  const total = useMemo(() => {
    return DAYS.reduce(
      (sum, d) => sum + (Number(draft[d]?.hours) || 0),
      0,
    );
  }, [draft]);

  const canSubmit = useMemo(() => {
    if (!editable || !week) return false;
    if (total <= 0) return false;
    for (const d of DAYS) {
      const cell = draft[d];
      if ((Number(cell?.hours) || 0) > HIGH_HOURS
          && !(cell?.notes && cell.notes.trim().length > 0)) {
        return false;
      }
    }
    return true;
  }, [editable, week, draft, total]);

  function patchDay(day: DayOfWeek, next: Partial<TimesheetDayCell>) {
    if (!week || !editable) return;
    setDraft((curr) => ({
      ...curr,
      [day]: {
        ...curr[day],
        ...next,
        dayOfWeek: day,
      },
    }));
    dirtyRef.current[day] = true;
    if (patchTimers.current[day]) clearTimeout(patchTimers.current[day]!);
    patchTimers.current[day] = setTimeout(() => {
      void flushDay(day);
    }, PATCH_DEBOUNCE_MS);
  }

  async function flushDay(day: DayOfWeek) {
    if (!week) return;
    if (!dirtyRef.current[day]) return;
    const cell = draft[day];
    const hours = Number(cell?.hours) || 0;
    const notes = cell?.notes ?? '';
    if (hours < 0 || hours > 24) {
      toast.error(`${DAY_LABEL[day]}: hours must be between 0 and 24.`);
      return;
    }
    try {
      const res = await api.patch<TimesheetWeek>(
        `/api/v1/timesheets/${week.id}/days/${day}`,
        { hours, notes: notes.trim() ? notes.trim() : null },
      );
      setWeek(res.data);
      dirtyRef.current[day] = false;
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? `Couldn't save ${DAY_LABEL[day]}.`);
    }
  }

  async function submitWeek() {
    if (!week || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      // Flush every dirty cell first so a quick-typist intern doesn't lose
      // a last keystroke.
      for (const d of DAYS) {
        if (dirtyRef.current[d]) await flushDay(d);
      }
      await api.post(`/api/v1/timesheets/${week.id}/submit`);
      toast.success('Timesheet submitted.');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't submit.");
    } finally {
      setSubmitting(false);
    }
  }

  function shiftWeek(deltaWeeks: number) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + deltaWeeks * 7);
    setWeekStart(isoMonday(d));
  }

  if (loading) return <Skeleton />;
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!week) return null;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Timesheets</h1>
          <p className="mt-1 text-sm text-gray-600">
            Log your hours and notes each day. Submit at the end of the week —
            your Reporting Manager approves the total.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void submitWeek()}
          disabled={!canSubmit || submitting}
          title={
            !editable
              ? 'Locked'
              : total <= 0
                ? 'Add at least one hour'
                : !canSubmit
                  ? 'Days with more than 10 hours need a note'
                  : 'Submit for approval'
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          {submitting ? 'Submitting…' : 'Submit week'}
        </button>
      </header>

      {/* Status banner */}
      <StatusBanner status={week.status} reviewNote={week.reviewNote} />

      {/* Week selector */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Previous
        </button>
        <div className="text-sm font-medium text-gray-900">
          Week of {weekStart}
        </div>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Day grid */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-28">Day</th>
              <th className="px-3 py-2 text-left font-semibold w-24">Hours</th>
              <th className="px-3 py-2 text-left font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {DAYS.map((d) => {
              const cell = draft[d];
              const hours = Number(cell?.hours) || 0;
              const needsNote =
                hours > HIGH_HOURS
                && !(cell?.notes && cell.notes.trim().length > 0);
              return (
                <tr key={d}>
                  <td className="px-3 py-2 text-gray-700">{DAY_LABEL[d]}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      value={cell?.hours ?? 0}
                      onChange={(e) =>
                        patchDay(d, { hours: Number(e.target.value) })
                      }
                      onBlur={() => void flushDay(d)}
                      disabled={!editable}
                      className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={cell?.notes ?? ''}
                      onChange={(e) =>
                        patchDay(d, { notes: e.target.value })
                      }
                      onBlur={() => void flushDay(d)}
                      disabled={!editable}
                      placeholder={
                        needsNote
                          ? 'Required when hours > 10'
                          : 'What did you work on?'
                      }
                      className={
                        'w-full rounded-md border bg-white px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-50 '
                        + (needsNote
                          ? 'border-orange-400'
                          : 'border-gray-300')
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
                Total
              </td>
              <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                {total.toFixed(1)} hrs
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function StatusBanner({
  status,
  reviewNote,
}: {
  status: TimesheetStatus;
  reviewNote?: string;
}) {
  if (status === 'APPROVED') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <p>Approved. This week is locked.</p>
      </div>
    );
  }
  if (status === 'REJECTED') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
        <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <div>
          <p className="font-medium">Returned for correction.</p>
          {reviewNote && (
            <p className="mt-1 whitespace-pre-wrap text-orange-800">{reviewNote}</p>
          )}
        </div>
      </div>
    );
  }
  if (status === 'SUBMITTED') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <p>Submitted — awaiting your Reporting Manager.</p>
      </div>
    );
  }
  return null;
}

// ── helpers ────────────────────────────────────────────────────────────────

function isoMonday(d: Date): string {
  // Roll back to the Monday of the given date's week (ISO weeks start Monday).
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  copy.setDate(copy.getDate() + diff);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, '0');
  const dd = String(copy.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function emptyDays(): Record<DayOfWeek, TimesheetDayCell> {
  return DAYS.reduce(
    (acc, d) => {
      acc[d] = { dayOfWeek: d, hours: 0, notes: '' };
      return acc;
    },
    {} as Record<DayOfWeek, TimesheetDayCell>,
  );
}

function mergeDays(
  fromServer: TimesheetDayCell[],
): Record<DayOfWeek, TimesheetDayCell> {
  const out = emptyDays();
  for (const d of fromServer) {
    out[d.dayOfWeek] = {
      id: d.id,
      dayOfWeek: d.dayOfWeek,
      hours: Number(d.hours) || 0,
      notes: d.notes ?? '',
    };
  }
  return out;
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-1/3 animate-pulse rounded bg-gray-100" />
      <div className="h-12 animate-pulse rounded bg-gray-100" />
      <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
