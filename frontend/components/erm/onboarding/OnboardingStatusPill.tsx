'use client';

import type { OnboardingItemStatus } from './types';

const STYLES: Record<OnboardingItemStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  RESEND_REQUESTED: 'bg-indigo-100 text-indigo-800',
};

const LABEL: Record<OnboardingItemStatus, string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  RESEND_REQUESTED: 'Resend asked',
};

export default function OnboardingStatusPill({
  status,
}: {
  status: OnboardingItemStatus;
}) {
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
