'use client';

import type { ExceptionStatus } from './types';

const STYLES: Record<ExceptionStatus, string> = {
  OPEN: 'bg-rose-50 text-rose-700 ring-rose-200',
  ASSIGNED: 'bg-amber-50 text-amber-700 ring-amber-200',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  DISMISSED: 'bg-slate-100 text-slate-600 ring-slate-200',
  AUTO_RESOLVED: 'bg-brand-50 text-brand-700 ring-brand-200',
};

const LABEL: Record<ExceptionStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
  AUTO_RESOLVED: 'Auto-resolved',
};

export default function StatusPill({ status }: { status: ExceptionStatus }) {
  return (
    <span
      className={
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ' +
        STYLES[status]
      }
    >
      {LABEL[status]}
    </span>
  );
}
