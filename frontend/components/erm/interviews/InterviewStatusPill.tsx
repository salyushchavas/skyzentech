'use client';

import type { InterviewStatus } from './types';

const STYLES: Record<InterviewStatus, string> = {
  SCHEDULED: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-slate-100 text-slate-600',
  NO_SHOW: 'bg-rose-100 text-rose-800',
};

const LABEL: Record<InterviewStatus, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};

export default function InterviewStatusPill({ status }: { status: InterviewStatus }) {
  return (
    <span
      className={
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
        STYLES[status]
      }
    >
      {LABEL[status]}
    </span>
  );
}
