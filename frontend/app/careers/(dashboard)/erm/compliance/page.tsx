'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  Info,
  RefreshCw,
  Send,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import StatCard from '@/components/preview/StatCard';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  AlertSeverity,
  ComplianceAlert,
  ComplianceOverviewResponse,
  RecentAction,
  UpcomingDeadline,
} from '@/types';

export default function HrCompliancePage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'HR']}>
      <DashboardLayout title="Compliance Overview">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [overview, setOverview] = useState<ComplianceOverviewResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ComplianceOverviewResponse>(
        '/api/v1/compliance/overview'
      );
      setOverview(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load compliance data.");
      setOverview(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (overview === null && !error) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!overview) return null;

  const { stats, alerts, upcomingDeadlines, recentActions } = overview;

  return (
    <>
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Status snapshot
          </h2>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              className={'h-3.5 w-3.5 ' + (refreshing ? 'animate-spin' : '')}
              strokeWidth={2}
            />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {/* I-9 row */}
          <StatCard label="I-9 Pending" value={stats.i9.pending} icon={Clock} />
          <StatCard
            label="I-9 Overdue"
            value={stats.i9.overdue}
            icon={AlertTriangle}
          />
          <StatCard
            label="I-9 Complete"
            value={stats.i9.completed}
            icon={CheckCircle}
          />
          <StatCard label="I-9 Total" value={stats.i9.total} icon={FileText} />
          {/* I-983 + E-Verify row */}
          <StatCard
            label="I-983 Pending DSO"
            value={stats.i983.complete}
            icon={Clock}
          />
          <StatCard
            label="I-983 Approved"
            value={stats.i983.approved}
            icon={CheckCircle}
          />
          <StatCard
            label="E-Verify Open"
            value={stats.everify.open}
            icon={Activity}
          />
          <StatCard
            label="E-Verify TNC"
            value={stats.everify.tnc}
            icon={AlertTriangle}
          />
          {/* Offers + amendments row */}
          <StatCard
            label="Offers Pending"
            value={stats.offers.pending}
            icon={Clock}
          />
          <StatCard
            label="Offers Accepted (30d)"
            value={stats.offers.accepted}
            icon={CheckCircle}
          />
          <StatCard
            label="Amendments Requested"
            value={stats.i983.amendment}
            icon={AlertCircle}
          />
          <StatCard
            label="Pending Submissions"
            value={stats.everify.pendingSubmission}
            icon={Send}
          />
        </div>
      </section>

      <AlertsCard alerts={alerts} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DeadlinesCard deadlines={upcomingDeadlines} />
        <RecentActivityCard
          actions={recentActions}
          onRefresh={() => void refresh()}
        />
      </div>
    </>
  );
}

// ── Alerts card ─────────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<
  AlertSeverity,
  { Icon: LucideIcon; bg: string; fg: string }
> = {
  CRITICAL: { Icon: AlertTriangle, bg: 'bg-red-100', fg: 'text-red-600' },
  WARNING: { Icon: AlertCircle, bg: 'bg-amber-100', fg: 'text-amber-600' },
  INFO: { Icon: Info, bg: 'bg-blue-100', fg: 'text-blue-600' },
};

function AlertsCard({ alerts }: { alerts: ComplianceAlert[] }) {
  return (
    <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          Alerts
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {alerts.length}
          </span>
        </h2>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle className="h-4 w-4" strokeWidth={2} />
          All clear — no urgent items
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {alerts.map((a, i) => {
            const meta = SEVERITY_ICON[a.severity];
            const Icon = meta.Icon;
            return (
              <li
                key={i}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div
                  className={
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ' +
                    meta.bg
                  }
                >
                  <Icon className={'h-4 w-4 ' + meta.fg} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {a.title}
                  </div>
                  {a.description && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      {a.description}
                    </div>
                  )}
                </div>
                {a.linkUrl && (
                  <Link
                    href={a.linkUrl}
                    className="inline-flex flex-shrink-0 items-center gap-0.5 text-xs font-medium text-accent hover:text-accent-dark"
                  >
                    Resolve
                    <ArrowRight className="h-3 w-3" strokeWidth={2} />
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

// ── Deadlines card ──────────────────────────────────────────────────────────

function DeadlinesCard({ deadlines }: { deadlines: UpcomingDeadline[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
        Upcoming Deadlines
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {deadlines.length}
        </span>
      </h2>

      {deadlines.length === 0 ? (
        <p className="text-sm text-gray-500">
          No deadlines in the next 14 days
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {deadlines.map((d, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-900">{d.label}</div>
                {d.candidateName && (
                  <div className="text-xs text-gray-500">{d.candidateName}</div>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right">
                <div className="text-xs text-gray-500">
                  {formatDateOnly(d.dueDate)}
                </div>
                <DueChip days={d.daysUntilDue} />
                {d.linkUrl && (
                  <Link
                    href={d.linkUrl}
                    className="text-xs font-medium text-accent hover:text-accent-dark"
                  >
                    View →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DueChip({ days }: { days?: number }) {
  if (days == null) return <span className="text-xs text-gray-400">—</span>;
  if (days < 0) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Overdue by {Math.abs(days)} days
      </span>
    );
  }
  if (days <= 2) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        {days} day{days === 1 ? '' : 's'}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {days} days
    </span>
  );
}

// ── Recent activity card ────────────────────────────────────────────────────

const ENTITY_ICON: Record<string, LucideIcon> = {
  I9Form: FileText,
  I983Plan: FileText,
  Offer: FileText,
  EVerifyCase: ShieldCheck,
  Application: FileText,
  Interview: FileText,
  OnboardingTask: FileText,
};

function RecentActivityCard({
  actions,
  onRefresh,
}: {
  actions: RecentAction[];
  onRefresh: () => void;
}) {
  const displayed = actions.slice(0, 15);
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          Recent Compliance Activity
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Refresh activity"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-gray-500">No recent compliance activity</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {displayed.map((a, i) => {
              const Icon: LucideIcon =
                (a.entityType && ENTITY_ICON[a.entityType]) || FileText;
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <Icon
                      className="h-3.5 w-3.5 text-gray-500"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-900">{a.summary}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {a.performedByName ?? 'System'}
                      {a.performedByRole && (
                        <span className="text-gray-400">
                          {' '}
                          ({a.performedByRole})
                        </span>
                      )}{' '}
                      · {formatRelative(a.timestamp)}
                    </div>
                  </div>
                  {a.entityLinkUrl && (
                    <Link
                      href={a.entityLinkUrl}
                      className="flex-shrink-0 text-sm text-accent hover:text-accent-dark"
                      aria-label="View entity"
                    >
                      →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-gray-100 pt-3 text-center">
            <Link
              href="/careers/hr/documents"
              className="text-xs font-medium text-accent hover:text-accent-dark"
            >
              View all activity →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

// ── Loading ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-gray-200 bg-white"
          />
        ))}
      </div>
      <div className="mb-8 space-y-3 rounded-lg border border-gray-200 bg-white p-6">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-12 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-12 w-full animate-pulse rounded bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border border-gray-200 bg-white" />
        <div className="h-64 animate-pulse rounded-lg border border-gray-200 bg-white" />
      </div>
    </>
  );
}
