'use client';

import type {
  EvaluationState,
  MeetingDocState,
  TimesheetState,
} from './types';

type Variant = 'meeting' | 'evaluation' | 'timesheet';

const TONE: Record<string, string> = {
  // Meeting
  SCHEDULED: 'bg-amber-50 text-amber-800 ring-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  MISSED: 'bg-rose-50 text-rose-700 ring-rose-200',
  RESCHEDULED: 'bg-purple-50 text-purple-700 ring-purple-200',
  NONE: 'bg-slate-100 text-slate-600 ring-slate-200',
  // Evaluation (reuses scheduled / completed / none, adds overdue)
  OVERDUE: 'bg-rose-50 text-rose-700 ring-rose-200',
  // Timesheet (reuses submitted/approved/rejected/missing)
  SUBMITTED: 'bg-amber-50 text-amber-800 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
  MISSING: 'bg-slate-100 text-slate-600 ring-slate-200',
  DRAFT: 'bg-sky-50 text-sky-700 ring-sky-200',
};

const LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  MISSED: 'Missed',
  RESCHEDULED: 'Rescheduled',
  NONE: '—',
  OVERDUE: 'Overdue',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  MISSING: 'Missing',
  DRAFT: 'Draft',
};

export default function StateBadge({
  state,
  variant,
}: {
  state: MeetingDocState | EvaluationState | TimesheetState | string;
  variant?: Variant;
}) {
  void variant; // reserved for variant-specific overrides later
  return (
    <span
      className={
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ' +
        (TONE[state] ?? 'bg-slate-100 text-slate-600 ring-slate-200')
      }
    >
      {LABEL[state] ?? state}
    </span>
  );
}
