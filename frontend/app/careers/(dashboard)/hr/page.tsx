'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRelative, formatDueDate } from '@/lib/format-date';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import type { Uuid } from '@/types';

/**
 * HR / Compliance command center. Phase-1 dashboard reusing the candidate +
 * operations dashboards' card grammar (rounded-lg cards on white, accent
 * accents, formatRelative for times). The deeper compliance view continues
 * to live at /careers/hr/compliance — this is the landing summary.
 *
 * Backed by GET /api/v1/hr/dashboard. The payload deliberately carries no
 * raw PII (no SSN, A-Number, document numbers, DOB) and exposes no audit-
 * log download — full audit export stays on the SUPER_ADMIN admin pages.
 */

interface HrActionItem {
  key: string;
  label: string;
  count: number;
  href: string;
}

interface ComplianceStatusBoard {
  offerAccepted: number;
  i983InProgress: number;
  i9Section1Pending: number;
  i9Section2Pending: number;
  everifyOpen: number;
  cleared: number;
}

interface AuthExpiryItem {
  candidateId: Uuid;
  candidateName: string | null;
  authType: string;
  expirationDate: string | null;
  daysUntilExpiry: number | null;
  linkUrl: string | null;
}

interface OfferStatusSummary {
  sent: number;
  accepted: number;
  pending: number;
}

interface AuditFeedItem {
  timestamp: string | null;
  summary: string | null;
  entityType: string | null;
  linkUrl: string | null;
}

interface HrDashboardResponse {
  operatorName: string | null;
  needsAttention: HrActionItem[];
  statusBoard: ComplianceStatusBoard;
  authExpiry: AuthExpiryItem[];
  offerStatus: OfferStatusSummary;
  auditFeed: AuditFeedItem[];
}

const STATUS_STAGES: ReadonlyArray<{
  key: keyof ComplianceStatusBoard;
  label: string;
  icon: typeof CheckCircle;
}> = [
  { key: 'offerAccepted', label: 'Offer accepted', icon: FileSignature },
  { key: 'i983InProgress', label: 'I-983 in progress', icon: ClipboardList },
  { key: 'i9Section1Pending', label: 'I-9 §1 pending', icon: AlertTriangle },
  { key: 'i9Section2Pending', label: 'I-9 §2 pending', icon: ShieldCheck },
  { key: 'everifyOpen', label: 'E-Verify open', icon: BadgeCheck },
  { key: 'cleared', label: 'Cleared', icon: CheckCircle },
];

export default function HrDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'SUPER_ADMIN']}>
      <DashboardLayout title="HR Compliance Dashboard">
        <HrDashboardBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function HrDashboardBody() {
  const { user } = useAuth();
  const [data, setData] = useState<HrDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<HrDashboardResponse>('/api/v1/hr/dashboard');
      setData(res.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the dashboard.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }
  if (data === null) return <DashboardSkeleton />;

  const operatorName = data.operatorName ?? user?.fullName ?? null;
  const totalActions = data.needsAttention.reduce((s, a) => s + a.count, 0);
  const urgentExpiry = data.authExpiry.filter(
    (e) => e.daysUntilExpiry !== null && e.daysUntilExpiry !== undefined && e.daysUntilExpiry <= 30,
  ).length;

  return (
    <section className="space-y-6">
      <Header
        operatorName={operatorName}
        totalActions={totalActions}
        urgentExpiry={urgentExpiry}
      />

      <NeedsAttention items={data.needsAttention} />

      <AwaitingActivationCard />

      <ComplianceStatusBoardCard board={data.statusBoard} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AuthExpiryCard items={data.authExpiry} />
        </div>
        <OfferStatusCard summary={data.offerStatus} />
      </div>

      <AuditFeedCard items={data.auditFeed} />
    </section>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({
  operatorName,
  totalActions,
  urgentExpiry,
}: {
  operatorName: string | null;
  totalActions: number;
  urgentExpiry: number;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back{operatorName ? `, ${operatorName}` : ''}.
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span
            className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800"
            title="You're signed in as HR / Compliance"
          >
            HR / Compliance
          </span>
          {totalActions > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
              {totalActions} action{totalActions === 1 ? '' : 's'} pending
            </span>
          )}
          {urgentExpiry > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-800">
              {urgentExpiry} expiring ≤30d
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        aria-label="Notifications (coming soon)"
        title="Notifications — coming soon"
        className="relative rounded-full border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50"
      >
        <Bell className="h-4 w-4" strokeWidth={2} />
      </button>
    </header>
  );
}

// ── Needs your attention ────────────────────────────────────────────────────

function NeedsAttention({ items }: { items: HrActionItem[] }) {
  const hot = items.filter((i) => i.count > 0);
  const allQuiet = hot.length === 0;

  return (
    <section className="rounded-xl border-2 border-accent/30 bg-accent/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent-dark">
          Needs your attention
        </h2>
        {allQuiet && (
          <span className="text-xs italic text-gray-500">
            All caught up — nothing flagged for HR review.
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={
              'group flex items-start gap-3 rounded-lg border p-3 transition-colors ' +
              (item.count > 0
                ? 'border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50'
                : 'border-gray-200 bg-white/70 hover:bg-gray-50')
            }
          >
            <div
              className={
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' +
                (item.count > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500')
              }
            >
              <ActionIcon keyName={item.key} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={
                    'text-lg font-semibold ' +
                    (item.count > 0 ? 'text-gray-900' : 'text-gray-400')
                  }
                >
                  {item.count}
                </span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-gray-400 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-0.5 text-xs font-medium text-gray-700">{item.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ActionIcon({ keyName }: { keyName: string }) {
  const cn = 'h-4 w-4';
  switch (keyName) {
    case 'I9_SECTION_2_PENDING':
      return <ShieldCheck className={cn} strokeWidth={2} />;
    case 'EVERIFY_TO_ACTION':
      return <BadgeCheck className={cn} strokeWidth={2} />;
    case 'I983_AWAITING_EMPLOYER':
      return <FileSignature className={cn} strokeWidth={2} />;
    case 'TNC_TO_ACTION':
      return <AlertCircle className={cn} strokeWidth={2} />;
    case 'WORK_AUTH_EXPIRING':
      return <CalendarClock className={cn} strokeWidth={2} />;
    default:
      return <TrendingUp className={cn} strokeWidth={2} />;
  }
}

// ── Compliance status board ─────────────────────────────────────────────────

function ComplianceStatusBoardCard({ board }: { board: ComplianceStatusBoard }) {
  const total =
    board.offerAccepted +
    board.i983InProgress +
    board.i9Section1Pending +
    board.i9Section2Pending +
    board.everifyOpen +
    board.cleared;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Compliance status board</h2>
        </div>
        <Link
          href="/careers/hr/compliance"
          className="text-xs font-medium text-accent hover:underline"
        >
          Open compliance view →
        </Link>
      </div>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No active compliance workload right now.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_STAGES.map((stage) => {
            const value = board[stage.key];
            const Icon = stage.icon;
            const isCleared = stage.key === 'cleared';
            return (
              <div
                key={stage.key}
                className="flex flex-col rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div
                  className={
                    'mb-2 flex h-7 w-7 items-center justify-center rounded-full ' +
                    (isCleared
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-accent/15 text-accent-dark')
                  }
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </div>
                <div className="text-xl font-semibold text-gray-900">{value}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-500">
                  {stage.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[11px] italic text-gray-500">
        Counts are independent — a single candidate may appear in more than one stage.
      </p>
    </section>
  );
}

// ── Authorization expiry reminders ──────────────────────────────────────────

function AuthExpiryCard({ items }: { items: AuthExpiryItem[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">
            Authorization expiry reminders
          </h2>
        </div>
        <span className="text-[11px] text-gray-500">Next 180 days</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No upcoming work-authorization expirations.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const urgency = expiryUrgency(item.daysUntilExpiry);
            const wrap =
              urgency === 'critical'
                ? 'border-red-200 bg-red-50'
                : urgency === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-gray-200 bg-white';
            const iconWrap =
              urgency === 'critical'
                ? 'bg-red-200 text-red-800'
                : urgency === 'warning'
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-sky-100 text-sky-700';
            return (
              <li
                key={`${item.candidateId}-${item.authType}-${item.expirationDate}`}
                className={
                  'flex items-start gap-3 rounded-lg border p-3 ' + wrap
                }
              >
                <div
                  className={
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ' +
                    iconWrap
                  }
                >
                  <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {item.candidateName ?? '—'}{' '}
                    <span className="font-normal text-gray-500">· {item.authType}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {item.expirationDate ?? '—'}
                    {item.daysUntilExpiry !== null && item.daysUntilExpiry !== undefined && (
                      <>
                        {' · '}
                        {item.daysUntilExpiry >= 0
                          ? `${formatDueDate(item.expirationDate)}`
                          : `${Math.abs(item.daysUntilExpiry)} days overdue`}
                      </>
                    )}
                  </div>
                </div>
                {item.linkUrl && (
                  <Link
                    href={item.linkUrl}
                    className="shrink-0 self-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Open
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function expiryUrgency(days: number | null | undefined): 'critical' | 'warning' | 'info' {
  if (days === null || days === undefined) return 'info';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  return 'info';
}

// ── Offer status summary ────────────────────────────────────────────────────

function OfferStatusCard({ summary }: { summary: OfferStatusSummary }) {
  const items: { label: string; value: number; tone: string }[] = [
    { label: 'Out', value: summary.sent, tone: 'bg-sky-100 text-sky-800' },
    { label: 'Accepted (30d)', value: summary.accepted, tone: 'bg-emerald-100 text-emerald-800' },
    { label: 'In draft', value: summary.pending, tone: 'bg-gray-100 text-gray-700' },
  ];
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Offer status</h2>
        </div>
        <Link
          href="/careers/hr/offers"
          className="text-xs font-medium text-accent hover:underline"
        >
          Manage offers →
        </Link>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
          >
            <span className="text-xs uppercase tracking-wide text-gray-600">
              {item.label}
            </span>
            <span
              className={
                'rounded-full px-2 py-0.5 text-sm font-semibold ' + item.tone
              }
            >
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Audit feed (read-only) ──────────────────────────────────────────────────

function AuditFeedCard({ items }: { items: AuditFeedItem[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Compliance audit feed</h2>
        </div>
        <span className="text-[11px] italic text-gray-500">Read-only</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No recent compliance activity.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((entry, i) => (
            <li
              key={`${entry.timestamp ?? ''}-${i}`}
              className="flex items-start gap-3"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-900">
                  {entry.linkUrl ? (
                    <Link href={entry.linkUrl} className="hover:underline">
                      {entry.summary ?? '—'}
                    </Link>
                  ) : (
                    entry.summary ?? '—'
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {entry.timestamp ? formatRelative(entry.timestamp) : '—'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="h-28 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      <div className="h-32 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-56 animate-pulse rounded-lg border border-gray-100 bg-gray-50 lg:col-span-2" />
        <div className="h-56 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      </div>
      <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
    </div>
  );
}

// ── Awaiting activation ─────────────────────────────────────────────────────
//
// Engagements that have cleared every compliance item but still sit at
// PENDING_COMPLIANCE — HR clicks "Activate" to flip them to READY_TO_START
// via the existing markReady endpoint. Empty state hides the card so the
// landing doesn't carry an empty box on steady-state days.

interface AwaitingActivationRow {
  engagementId: Uuid;
  candidateId: Uuid | null;
  candidateName: string | null;
  position: string | null;
}

function AwaitingActivationCard() {
  const [rows, setRows] = useState<AwaitingActivationRow[] | null>(null);
  const [activating, setActivating] = useState<Uuid | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<AwaitingActivationRow[]>(
        '/api/v1/engagements/awaiting-activation',
      );
      setRows(res.data ?? []);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function activate(engagementId: Uuid) {
    if (activating) return;
    setActivating(engagementId);
    try {
      await api.post(`/api/v1/engagements/${engagementId}/mark-ready`);
      toast.success('Engagement activated.');
      await load();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ?? "Couldn't activate the engagement.",
      );
    } finally {
      setActivating(null);
    }
  }

  if (rows === null) return null;
  if (rows.length === 0) return null;

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-700" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">
          Awaiting activation ({rows.length})
        </h2>
      </div>
      <p className="mb-3 text-xs text-gray-600">
        Every compliance item is signed off — click activate to start the
        engagement.
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.engagementId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-100 bg-white px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Users className="h-3.5 w-3.5 shrink-0 text-emerald-700" strokeWidth={2} />
              <div className="min-w-0">
                <Link
                  href={
                    row.candidateId
                      ? `/careers/supervised/${row.candidateId}`
                      : '#'
                  }
                  className="block truncate text-sm font-medium text-gray-900 hover:text-accent-dark hover:underline"
                >
                  {row.candidateName ?? '—'}
                </Link>
                <div className="truncate text-xs text-gray-500">
                  {row.position ?? '—'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void activate(row.engagementId)}
              disabled={activating !== null}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
              {activating === row.engagementId
                ? 'Activating…'
                : 'Activate Engagement'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
