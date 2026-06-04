'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  HeartHandshake,
  Landmark,
  ScrollText,
  ShieldCheck,
  Sparkles,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import InternPageShell from '@/components/intern/InternPageShell';

type ItemStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'RESEND_REQUESTED';

interface PacketItem {
  id: string;
  category: string;
  required: boolean;
  status: ItemStatus;
  documentId?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  ermComments?: string | null;
  version: number;
  updatedAt: string;
}

interface PacketResponse {
  id: string;
  userId: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED';
  assignedAt: string;
  acceptedAt?: string | null;
  requiredCount: number;
  acceptedCount: number;
  items: PacketItem[];
}

const CATEGORY_META: Record<string, { title: string; tagline: string; icon: LucideIcon }> = {
  W4:                { title: 'W-4',                       tagline: 'Tax withholding form',                          icon: ScrollText },
  I9:                { title: 'I-9 Section 1',             tagline: 'Employment eligibility verification',           icon: ShieldCheck },
  ACH:               { title: 'Direct Deposit (ACH)',      tagline: 'Set up where you get paid',                     icon: Landmark },
  EMERGENCY_CONTACT: { title: 'Emergency Contact',         tagline: 'Who we should reach in an emergency',           icon: HeartHandshake },
  HANDBOOK_ACK:      { title: 'Handbook Acknowledgment',   tagline: 'Read and sign off on the employee handbook',    icon: FileSignature },
  I983:              { title: 'I-983 Training Plan',       tagline: 'STEM OPT training plan (student section)',      icon: ClipboardCheck },
};

const STATUS_PILL: Record<ItemStatus, string> = {
  PENDING:           'bg-slate-100 text-slate-700',
  SUBMITTED:         'bg-blue-100 text-blue-800',
  ACCEPTED:          'bg-emerald-100 text-emerald-800',
  REJECTED:          'bg-rose-100 text-rose-800',
  RESEND_REQUESTED:  'bg-amber-100 text-amber-800',
};

const PACKET_PILL: Record<string, string> = {
  ASSIGNED:    'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  IN_REVIEW:   'bg-amber-100 text-amber-800',
  ACCEPTED:    'bg-emerald-100 text-emerald-800',
  REJECTED:    'bg-rose-100 text-rose-800',
};

export default function InternOnboardingPage() {
  const [packet, setPacket] = useState<PacketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PacketResponse>('/api/v1/onboarding/packet');
      setPacket(res.data);
    } catch (e) {
      const ax = e as { response?: { status?: number; data?: { error?: string } } };
      if (ax.response?.status === 404) {
        setErr('Your onboarding packet has not been assigned yet.');
      } else {
        setErr(e instanceof Error ? e.message : 'Failed to load packet');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <InternPageShell title="Onboarding">
        <div className="h-48 animate-pulse rounded-lg bg-slate-50" aria-hidden />
      </InternPageShell>
    );
  }
  if (err) {
    return (
      <InternPageShell title="Onboarding">
        <p className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          {err}
        </p>
      </InternPageShell>
    );
  }
  if (!packet) return null;

  const progress = packet.requiredCount > 0
    ? Math.round((packet.acceptedCount / packet.requiredCount) * 100)
    : 0;

  return (
    <InternPageShell
      title="Onboarding"
      subtitle={
        <span className={'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ' + (PACKET_PILL[packet.status] ?? 'bg-slate-100 text-slate-700')}>
          {packet.status.replaceAll('_', ' ')}
        </span>
      }
    >
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Packet progress</h2>
            <p className="mt-1 text-xs text-slate-500">
              {packet.acceptedCount} of {packet.requiredCount} required items accepted
            </p>
          </div>
          {packet.status === 'ACCEPTED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} />
              All set — awaiting your start date
            </span>
          )}
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>
      </section>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {packet.items.map((it) => (
          <ItemCard key={it.id} item={it} />
        ))}
      </ul>
    </InternPageShell>
  );
}

function ItemCard({ item }: { item: PacketItem }) {
  const meta = CATEGORY_META[item.category] ?? {
    title: item.category,
    tagline: '',
    icon: ClipboardCheck,
  };
  const Icon = meta.icon;
  const blocked = item.status === 'ACCEPTED';
  const ctaLabel =
    item.status === 'PENDING' ? 'Start' :
    item.status === 'SUBMITTED' ? 'View submission' :
    item.status === 'ACCEPTED' ? 'View' :
    'Fix and resubmit';

  return (
    <li className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">{meta.title}</h3>
            {item.required && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Required
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{meta.tagline}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {(item.status === 'REJECTED' || item.status === 'RESEND_REQUESTED') && item.ermComments && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="mb-1 flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
            ERM feedback
          </div>
          <p className="whitespace-pre-wrap">{item.ermComments}</p>
          <p className="mt-2 text-[11px] text-amber-700">Address feedback and resubmit.</p>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[11px] text-slate-400">
          {item.submittedAt
            ? `Submitted ${new Date(item.submittedAt).toLocaleDateString()}`
            : 'Not submitted yet'}
        </span>
        <Link
          href={`/careers/intern/onboarding/${item.id}`}
          className={
            'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors '
            + (blocked
              ? 'bg-slate-100 text-slate-500'
              : 'bg-teal-700 text-white hover:bg-teal-800')
          }
        >
          {ctaLabel}
        </Link>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const icon =
    status === 'ACCEPTED' ? <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} /> :
    status === 'REJECTED' ? <XCircle className="h-3 w-3" strokeWidth={2.5} /> :
    null;
  return (
    <span className={
      'ml-2 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
      + (STATUS_PILL[status] ?? 'bg-slate-100 text-slate-700')
    }>
      {icon}
      {status.replaceAll('_', ' ')}
    </span>
  );
}
