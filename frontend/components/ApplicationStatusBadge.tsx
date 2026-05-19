import type { ApplicationStatus } from '@/types';

interface Props {
  status: ApplicationStatus | string;
}

const COLOR_MAP: Record<string, string> = {
  APPLIED: 'bg-blue-100 text-blue-800',
  SHORTLISTED: 'bg-indigo-100 text-indigo-800',
  INTERVIEW_SCHEDULED: 'bg-purple-100 text-purple-800',
  INTERVIEWED: 'bg-violet-100 text-violet-800',
  OFFERED: 'bg-teal-100 text-teal-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  ONBOARDING: 'bg-cyan-100 text-cyan-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-100 text-gray-700',
  LAPSED: 'bg-gray-100 text-gray-700',
  NO_SHOW: 'bg-orange-100 text-orange-800',
  // Spec-mentioned aliases the backend may add later; safe to keep in the map.
  OFFER_EXTENDED: 'bg-teal-100 text-teal-800',
  OFFER_ACCEPTED: 'bg-green-100 text-green-800',
  OFFER_DECLINED: 'bg-orange-100 text-orange-800',
  HIRED: 'bg-emerald-100 text-emerald-800',
};

function titleCase(raw: string): string {
  return raw
    .split('_')
    .map((part) => (part ? part[0] + part.slice(1).toLowerCase() : part))
    .join(' ');
}

export default function ApplicationStatusBadge({ status }: Props) {
  const color = COLOR_MAP[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ' + color
      }
    >
      {titleCase(status)}
    </span>
  );
}
