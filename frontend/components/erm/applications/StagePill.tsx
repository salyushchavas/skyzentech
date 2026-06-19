'use client';

const STYLES: Record<string, string> = {
  APPLIED: 'bg-blue-100 text-blue-800',
  HOLD: 'bg-slate-200 text-slate-700',
  INFO_REQUESTED: 'bg-purple-100 text-purple-800',
  SCREENING_SENT: 'bg-indigo-100 text-indigo-800',
  SCREENING_COMPLETED: 'bg-indigo-100 text-indigo-800',
  SHORTLISTED: 'bg-amber-100 text-amber-800',
  INTERVIEW_SCHEDULED: 'bg-amber-100 text-amber-800',
  INTERVIEWED: 'bg-amber-100 text-amber-800',
  SELECTED_CONDITIONAL: 'bg-brand-100 text-brand-800',
  OFFERED: 'bg-brand-100 text-brand-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  HIRED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  WITHDRAWN: 'bg-slate-100 text-slate-600',
  LAPSED: 'bg-slate-100 text-slate-600',
  NO_SHOW: 'bg-rose-100 text-rose-800',
};

const LABEL: Record<string, string> = {
  APPLIED: 'Applied',
  HOLD: 'Hold',
  INFO_REQUESTED: 'Info requested',
  SCREENING_SENT: 'Screening sent',
  SCREENING_COMPLETED: 'Screening done',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEWED: 'Interviewed',
  SELECTED_CONDITIONAL: 'Selected',
  OFFERED: 'Offered',
  ACCEPTED: 'Accepted',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  LAPSED: 'Lapsed',
  NO_SHOW: 'No-show',
};

export default function StagePill({ stage }: { stage: string }) {
  const cls = STYLES[stage] ?? 'bg-slate-100 text-slate-700';
  return (
    <span
      className={
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ' + cls
      }
    >
      {LABEL[stage] ?? stage}
    </span>
  );
}
