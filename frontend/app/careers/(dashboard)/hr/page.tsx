'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  FileSignature,
  FolderArchive,
  Info,
  ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { formatRelative } from '@/lib/format-date';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

interface I9Stats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
}

interface I983Stats {
  total: number;
  draft: number;
  complete: number;
  submittedToDso: number;
  approved: number;
  rejected: number;
  amendment: number;
}

interface EverifyStats {
  total: number;
  pendingSubmission: number;
  open: number;
  tnc: number;
  authorized: number;
  closed: number;
}

interface OfferStats {
  totalActive: number;
  pending: number;
  accepted: number;
  declined: number;
}

interface ComplianceStats {
  i9: I9Stats | null;
  i983: I983Stats | null;
  everify: EverifyStats | null;
  offers: OfferStats | null;
}

type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

interface ComplianceAlert {
  severity: AlertSeverity;
  title: string;
  description: string | null;
  linkUrl: string | null;
  count?: number | null;
}

interface UpcomingDeadline {
  label: string;
  dueDate: string | null;
  daysUntilDue: number | null;
  candidateName: string | null;
  linkUrl: string | null;
}

interface RecentAction {
  timestamp: string | null;
  summary: string | null;
  performedByName: string | null;
  performedByRole: string | null;
  entityType: string | null;
  entityLinkUrl: string | null;
}

interface ComplianceOverviewResponse {
  stats: ComplianceStats | null;
  alerts: ComplianceAlert[] | null;
  upcomingDeadlines: UpcomingDeadline[] | null;
  recentActions: RecentAction[] | null;
}

export default function HrDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'HR_COMPLIANCE']}>
      <DashboardLayout title="HR Dashboard">
        <HrBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function HrBody() {
  const [data, setData] = useState<ComplianceOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ComplianceOverviewResponse>(
        '/api/v1/compliance/overview',
      );
      setData(res.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the HR overview.");
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

  if (data === null) {
    return <SkeletonView />;
  }

  const stats = data.stats ?? null;
  const alerts = data.alerts ?? [];
  const deadlines = data.upcomingDeadlines ?? [];
  const actions = data.recentActions ?? [];

  const allEmpty =
    alerts.length === 0 &&
    deadlines.length === 0 &&
    (!stats?.i9 || stats.i9.pending === 0) &&
    (!stats?.i983 || stats.i983.total === 0);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">HR Compliance</h1>
        <p className="mt-1 text-sm text-gray-600">
          I-9 verifications, I-983 training plans, and E-Verify cases at a glance.
        </p>
      </header>

      {/* Compliance-health cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <I9Card stats={stats?.i9 ?? null} />
        <I983Card stats={stats?.i983 ?? null} />
        <EverifyCard stats={stats?.everify ?? null} />
      </div>

      {/* Two-column lower section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Needs your attention */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">Needs your attention</h2>
          {alerts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
              <BadgeCheck
                className="mx-auto mb-2 h-8 w-8 text-emerald-500"
                strokeWidth={1.5}
              />
              <p className="text-sm font-medium text-gray-700">All caught up.</p>
              <p className="text-xs text-gray-500">
                Nothing currently flagged for HR review.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li key={i}>
                  <AlertRow alert={a} />
                </li>
              ))}
            </ul>
          )}

          {deadlines.length > 0 && (
            <>
              <h2 className="pt-3 text-lg font-semibold text-gray-900">
                Upcoming deadlines
              </h2>
              <ul className="space-y-2">
                {deadlines.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <CalendarClock
                        className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                        strokeWidth={2}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {d.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {d.dueDate ?? '—'}
                          {d.daysUntilDue != null ? (
                            <>
                              {' '}
                              ·{' '}
                              {d.daysUntilDue >= 0
                                ? `in ${d.daysUntilDue} day${d.daysUntilDue === 1 ? '' : 's'}`
                                : `${Math.abs(d.daysUntilDue)} day${Math.abs(d.daysUntilDue) === 1 ? '' : 's'} overdue`}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {d.linkUrl && (
                      <Link
                        href={d.linkUrl}
                        className="shrink-0 text-xs font-medium text-accent hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Right column: vault links + recent activity */}
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Compliance vault</h2>
            <ul className="space-y-1.5 text-sm">
              <VaultLink
                href="/careers/hr/i9-everify"
                icon={<ShieldCheck className="h-4 w-4" strokeWidth={2} />}
                label="I-9 & E-Verify"
              />
              <VaultLink
                href="/careers/hr/compliance"
                icon={<Briefcase className="h-4 w-4" strokeWidth={2} />}
                label="Compliance overview"
              />
              <VaultLink
                href="/careers/hr/offers"
                icon={<FileSignature className="h-4 w-4" strokeWidth={2} />}
                label="Offer letters"
              />
              <VaultLink
                href="/careers/hr/documents"
                icon={<FolderArchive className="h-4 w-4" strokeWidth={2} />}
                label="Document vault"
              />
            </ul>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent activity</h2>
            {actions.length === 0 ? (
              <p className="text-sm text-gray-500">No recent activity.</p>
            ) : (
              <ul className="space-y-3">
                {actions.slice(0, 8).map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900">
                        {a.entityLinkUrl ? (
                          <Link href={a.entityLinkUrl} className="hover:underline">
                            {a.summary ?? '—'}
                          </Link>
                        ) : (
                          a.summary ?? '—'
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {a.timestamp ? formatRelative(a.timestamp) : '—'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {allEmpty && (
        <p className="text-center text-xs text-gray-400">
          No active compliance workload right now.
        </p>
      )}
    </section>
  );
}

// ── Health cards ─────────────────────────────────────────────────────────────

function I9Card({ stats }: { stats: I9Stats | null }) {
  return (
    <HealthCard
      title="I-9 Verifications"
      icon={<ShieldCheck className="h-4 w-4" strokeWidth={2} />}
      href="/careers/hr/i9-everify"
      primaryLabel="Pending"
      primaryValue={stats?.pending ?? 0}
      tone={stats && stats.overdue > 0 ? 'urgent' : 'info'}
      breakdown={
        stats
          ? [
              { label: 'Completed', value: stats.completed },
              { label: 'Overdue', value: stats.overdue, tone: 'urgent' },
              { label: 'Total', value: stats.total },
            ]
          : []
      }
    />
  );
}

function I983Card({ stats }: { stats: I983Stats | null }) {
  const pending = stats
    ? stats.draft + stats.complete + stats.submittedToDso + stats.amendment
    : 0;
  return (
    <HealthCard
      title="I-983 Training Plans"
      icon={<FileSignature className="h-4 w-4" strokeWidth={2} />}
      href="/careers/erm/training-plans"
      primaryLabel="In progress"
      primaryValue={pending}
      tone={stats && stats.amendment > 0 ? 'warning' : 'info'}
      breakdown={
        stats
          ? [
              { label: 'Submitted', value: stats.submittedToDso },
              { label: 'Approved', value: stats.approved },
              { label: 'Amendments', value: stats.amendment, tone: 'warning' },
            ]
          : []
      }
    />
  );
}

function EverifyCard({ stats }: { stats: EverifyStats | null }) {
  const pending = stats ? stats.pendingSubmission + stats.open : 0;
  return (
    <HealthCard
      title="E-Verify Cases"
      icon={<BadgeCheck className="h-4 w-4" strokeWidth={2} />}
      href="/careers/hr/i9-everify"
      primaryLabel="Open"
      primaryValue={pending}
      tone={stats && stats.tnc > 0 ? 'urgent' : 'info'}
      breakdown={
        stats
          ? [
              { label: 'Authorized', value: stats.authorized },
              { label: 'TNC', value: stats.tnc, tone: 'urgent' },
              { label: 'Closed', value: stats.closed },
            ]
          : []
      }
    />
  );
}

function HealthCard({
  title,
  icon,
  href,
  primaryLabel,
  primaryValue,
  tone,
  breakdown,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  primaryLabel: string;
  primaryValue: number;
  tone: 'info' | 'warning' | 'urgent';
  breakdown: { label: string; value: number; tone?: 'warning' | 'urgent' }[];
}) {
  const toneRing =
    tone === 'urgent'
      ? 'border-red-300'
      : tone === 'warning'
        ? 'border-amber-300'
        : 'border-gray-200';
  return (
    <Link
      href={href}
      className={
        'block rounded-lg border bg-white p-5 transition hover:border-accent/40 hover:shadow-sm ' +
        toneRing
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          {icon}
          {title}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-gray-900">{primaryValue}</span>
        <span className="text-xs text-gray-500">{primaryLabel}</span>
      </div>
      {breakdown.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-gray-600">
          {breakdown.map((b) => (
            <li key={b.label} className="flex items-center justify-between">
              <span>{b.label}</span>
              <span
                className={
                  b.tone === 'urgent'
                    ? 'font-medium text-red-700'
                    : b.tone === 'warning'
                      ? 'font-medium text-amber-700'
                      : 'font-medium text-gray-900'
                }
              >
                {b.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

// ── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: ComplianceAlert }) {
  const sev = alert.severity;
  const wrap =
    sev === 'CRITICAL'
      ? 'border-red-200 bg-red-50'
      : sev === 'WARNING'
        ? 'border-amber-200 bg-amber-50'
        : 'border-blue-200 bg-blue-50';
  const icon =
    sev === 'CRITICAL' ? (
      <AlertCircle className="h-4 w-4 text-red-600" strokeWidth={2} />
    ) : sev === 'WARNING' ? (
      <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={2} />
    ) : (
      <Info className="h-4 w-4 text-blue-600" strokeWidth={2} />
    );

  return (
    <div className={'flex flex-wrap items-start gap-3 rounded-lg border p-4 ' + wrap}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900">{alert.title}</div>
        {alert.description && (
          <div className="text-xs text-gray-700">{alert.description}</div>
        )}
      </div>
      {alert.linkUrl && (
        <Link
          href={alert.linkUrl}
          className="shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Review
        </Link>
      )}
    </div>
  );
}

// ── Vault quick-links ────────────────────────────────────────────────────────

function VaultLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-gray-700 hover:bg-gray-50"
      >
        <span className="text-gray-500">{icon}</span>
        <span>{label}</span>
      </Link>
    </li>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonView() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg border border-gray-100 bg-gray-50"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-gray-100 bg-gray-50"
            />
          ))}
        </div>
        <div className="space-y-6">
          <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
          <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
        </div>
      </div>
    </div>
  );
}
