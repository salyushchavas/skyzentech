'use client';

const STYLES: Record<string, string> = {
  SELECTED: 'bg-emerald-100 text-emerald-800',
  HOLD: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

const LABEL: Record<string, string> = {
  SELECTED: 'Selected',
  HOLD: 'Hold',
  REJECTED: 'Rejected',
};

export default function DecisionPill({ decision }: { decision: string | null }) {
  if (!decision) return null;
  const cls = STYLES[decision] ?? 'bg-slate-100 text-slate-700';
  return (
    <span
      className={'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ' + cls}
    >
      {LABEL[decision] ?? decision}
    </span>
  );
}
