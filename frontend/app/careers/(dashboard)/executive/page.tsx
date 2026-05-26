'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-context';
import type { Uuid } from '@/types';

/**
 * Executive (leadership) dashboard. Strictly read-only oversight — counts,
 * rates, funnel + program / compliance / weekly-cycle / supervisor-load
 * rollups. NO action buttons anywhere, no notification bell, no to-do list.
 *
 * Charting: the app doesn't ship a chart library (no recharts / chart.js /
 * d3 in package.json). Funnel + rate visualizations use plain Tailwind div
 * bars — same pattern the operations dashboard uses — to stay zero-dep.
 *
 * Backed by GET /api/v1/executive/dashboard.
 */
export default function ExecutiveDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['EXECUTIVE', 'SUPER_ADMIN']}>
      <DashboardLayout title="Executive Dashboard">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

interface HiringFunnel {
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  hired: number;
  appliedToScreening: number | null;
  screeningToInterview: number | null;
  interviewToOffer: number | null;
  offerToHired: number | null;
  overall: number | null;
}

interface InternProgram {
  activeInterns: number;
  completedInterns: number;
  terminatedInterns: number;
  blockedInterns: number;
  completionRate: number | null;
  atRiskCount: number;
  evaluationsFinalizedCount: number;
  evaluationsInDraftCount: number;
  averageEvaluationRating: number | null;
}

interface ComplianceHealth {
  activeInternsTotal: number;
  clearedCount: number;
  clearedRate: number | null;
  i9CompletedCount: number;
  i9TotalCount: number;
  i9CompletionRate: number | null;
  everifyAuthorizedCount: number;
  everifyTotalCount: number;
  everifyCompletionRate: number | null;
  authorizationsExpiringSoonCount: number;
}

interface WeeklyCycleHealth {
  activeInternsThisWeek: number;
  reportsSubmittedThisWeek: number;
  reportSubmissionRate: number | null;
  reportsAwaitingApproval: number;
  timesheetsSubmittedThisWeek: number;
  timesheetSubmissionRate: number | null;
  timesheetsAwaitingApproval: number;
  overdueReportsLastWeek: number;
  overdueTimesheetsLastWeek: number;
}

interface SupervisorLoadRow {
  supervisorUserId: Uuid | null;
  supervisorName: string;
  activeInterns: number;
  pendingReports: number;
  pendingTimesheets: number;
}

interface ExecutiveDashboardResponse {
  operatorName: string | null;
  isSuperAdminView: boolean;
  hiringFunnel: HiringFunnel;
  internProgram: InternProgram;
  complianceHealth: ComplianceHealth;
  weeklyCycle: WeeklyCycleHealth;
  supervisorLoad: SupervisorLoadRow[];
}

function Body() {
  const { user } = useAuth();
  const [data, setData] = useState<ExecutiveDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ExecutiveDashboardResponse>(
        '/api/v1/executive/dashboard',
      );
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
  if (data === null) return <Skeleton />;

  const operatorName = data.operatorName ?? user?.fullName ?? null;

  return (
    <section className="space-y-6">
      <Header operatorName={operatorName} isSuperAdminView={data.isSuperAdminView} />

      <KpiRow
        funnel={data.hiringFunnel}
        program={data.internProgram}
        compliance={data.complianceHealth}
      />

      <FunnelCard funnel={data.hiringFunnel} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ComplianceCard compliance={data.complianceHealth} />
        <WeeklyCycleCard cycle={data.weeklyCycle} />
      </div>

      <SupervisorLoadCard rows={data.supervisorLoad} />
    </section>
  );
}

// ── Header (no bell — oversight only) ───────────────────────────────────────

function Header({
  operatorName,
  isSuperAdminView,
}: {
  operatorName: string | null;
  isSuperAdminView: boolean;
}) {
  return (
    <header>
      <h1 className="text-2xl font-semibold text-gray-900">
        Welcome back{operatorName ? `, ${operatorName}` : ''}.
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span
          className="rounded-full bg-violet-100 px-2.5 py-1 font-medium text-violet-800"
          title="You're signed in as Executive"
        >
          Executive
        </span>
        {isSuperAdminView && (
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-medium text-indigo-800">
            Super-admin
          </span>
        )}
        <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
          Read-only oversight
        </span>
      </div>
    </header>
  );
}

// ── KPI row ─────────────────────────────────────────────────────────────────

function KpiRow({
  funnel,
  program,
  compliance,
}: {
  funnel: HiringFunnel;
  program: InternProgram;
  compliance: ComplianceHealth;
}) {
  const ratingValue =
    program.averageEvaluationRating != null
      ? program.averageEvaluationRating.toFixed(1)
      : '—';
  const ratingSubtitle =
    program.evaluationsFinalizedCount > 0
      ? `${program.evaluationsFinalizedCount.toLocaleString()} finalized · ${program.evaluationsInDraftCount.toLocaleString()} in draft`
      : 'No evaluations finalized yet';
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Kpi
        icon={<TrendingUp className="h-4 w-4" strokeWidth={2} />}
        label="Funnel conversion"
        value={pct(funnel.overall)}
        subtitle={`${funnel.applied.toLocaleString()} applied → ${funnel.hired.toLocaleString()} hired`}
        tone="accent"
      />
      <Kpi
        icon={<Users className="h-4 w-4" strokeWidth={2} />}
        label="Active interns"
        value={program.activeInterns.toLocaleString()}
        subtitle={
          program.atRiskCount > 0
            ? `${program.atRiskCount} at risk this week`
            : 'All on track this week'
        }
        tone={program.atRiskCount > 0 ? 'warning' : 'good'}
      />
      <Kpi
        icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2} />}
        label="Completion rate"
        value={pct(program.completionRate)}
        subtitle={`${program.completedInterns.toLocaleString()} completed · ${program.terminatedInterns.toLocaleString()} terminated`}
        tone="good"
      />
      <Kpi
        icon={<Star className="h-4 w-4" strokeWidth={2} />}
        label="Avg. evaluation"
        value={ratingValue + (program.averageEvaluationRating != null ? ' / 5' : '')}
        subtitle={ratingSubtitle}
        tone="accent"
      />
      <Kpi
        icon={<ShieldCheck className="h-4 w-4" strokeWidth={2} />}
        label="Compliance cleared"
        value={pct(compliance.clearedRate)}
        subtitle={`${compliance.clearedCount.toLocaleString()} of ${compliance.activeInternsTotal.toLocaleString()} active`}
        tone="info"
      />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  tone: 'accent' | 'good' | 'warning' | 'info';
}) {
  const ring =
    tone === 'warning'
      ? 'border-amber-200'
      : tone === 'good'
        ? 'border-emerald-200'
        : tone === 'info'
          ? 'border-sky-200'
          : 'border-gray-200';
  return (
    <article className={'rounded-lg border bg-white p-5 ' + ring}>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="text-3xl font-semibold text-gray-900">{value}</div>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    </article>
  );
}

// ── Funnel ──────────────────────────────────────────────────────────────────

function FunnelCard({ funnel }: { funnel: HiringFunnel }) {
  const stages: { label: string; count: number; rate: number | null }[] = [
    { label: 'Applied', count: funnel.applied, rate: null },
    { label: 'Screening', count: funnel.screening, rate: funnel.appliedToScreening },
    { label: 'Interview', count: funnel.interview, rate: funnel.screeningToInterview },
    { label: 'Offer', count: funnel.offer, rate: funnel.interviewToOffer },
    { label: 'Hired', count: funnel.hired, rate: funnel.offerToHired },
  ];
  const max = Math.max(funnel.applied, funnel.screening, funnel.interview, funnel.offer, funnel.hired, 1);
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Hiring funnel</h2>
        </div>
        <span className="text-[11px] italic text-gray-500">
          Overall conversion: <span className="font-semibold text-gray-800">{pct(funnel.overall)}</span>
        </span>
      </div>
      {funnel.applied === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No applications in the funnel yet.
        </p>
      ) : (
        <ol className="space-y-3">
          {stages.map((stage, i) => {
            const widthPct = Math.max(2, Math.round((stage.count / max) * 100));
            return (
              <li key={stage.label} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-600">
                  {stage.label}
                </span>
                <div className="flex flex-1 items-center gap-3">
                  <div className="h-7 w-full rounded-md bg-gray-100">
                    <div
                      className="flex h-full items-center justify-end rounded-md bg-accent/70 px-2 text-xs font-semibold text-white"
                      style={{ width: `${widthPct}%` }}
                    >
                      {stage.count.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="w-20 shrink-0 text-right text-xs text-gray-500">
                  {i === 0 ? (
                    <span className="italic">top</span>
                  ) : stage.rate == null ? (
                    <span>—</span>
                  ) : (
                    <ConversionPill rate={stage.rate} />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function ConversionPill({ rate }: { rate: number }) {
  const display = pct(rate);
  // Visual cue: green ≥40%, amber 20–40%, gray <20% — purely advisory.
  const tone =
    rate >= 0.4
      ? 'bg-emerald-100 text-emerald-800'
      : rate >= 0.2
        ? 'bg-amber-100 text-amber-800'
        : 'bg-gray-100 text-gray-700';
  return (
    <span
      className={'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ' + tone}
    >
      {display}
    </span>
  );
}

// ── Compliance ──────────────────────────────────────────────────────────────

function ComplianceCard({ compliance }: { compliance: ComplianceHealth }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Compliance health</h2>
      </div>
      <RatesGrid
        rows={[
          {
            label: 'I-9 completion',
            rate: compliance.i9CompletionRate,
            sub: `${compliance.i9CompletedCount.toLocaleString()} of ${compliance.i9TotalCount.toLocaleString()}`,
            icon: <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />,
          },
          {
            label: 'E-Verify authorized',
            rate: compliance.everifyCompletionRate,
            sub: `${compliance.everifyAuthorizedCount.toLocaleString()} of ${compliance.everifyTotalCount.toLocaleString()}`,
            icon: <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />,
          },
        ]}
      />
      <div
        className={
          'mt-3 flex items-center gap-3 rounded-md border p-3 ' +
          (compliance.authorizationsExpiringSoonCount > 0
            ? 'border-amber-200 bg-amber-50'
            : 'border-gray-200 bg-gray-50')
        }
      >
        <div
          className={
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full ' +
            (compliance.authorizationsExpiringSoonCount > 0
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-500')
          }
        >
          <CalendarClock className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900">
            {compliance.authorizationsExpiringSoonCount.toLocaleString()} authorization
            {compliance.authorizationsExpiringSoonCount === 1 ? '' : 's'} expiring ≤ 90 days
          </div>
          <div className="text-xs text-gray-500">
            Combined I-9 work-auth + STEM OPT end dates
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Weekly cycle ────────────────────────────────────────────────────────────

function WeeklyCycleCard({ cycle }: { cycle: WeeklyCycleHealth }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Weekly cycle pulse</h2>
      </div>
      <RatesGrid
        rows={[
          {
            label: 'Reports submitted this week',
            rate: cycle.reportSubmissionRate,
            sub: `${cycle.reportsSubmittedThisWeek.toLocaleString()} of ${cycle.activeInternsThisWeek.toLocaleString()} active`,
            icon: <FileText className="h-3.5 w-3.5" strokeWidth={2} />,
          },
          {
            label: 'Timesheets submitted this week',
            rate: cycle.timesheetSubmissionRate,
            sub: `${cycle.timesheetsSubmittedThisWeek.toLocaleString()} of ${cycle.activeInternsThisWeek.toLocaleString()} active`,
            icon: <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />,
          },
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <BacklogTile
          label="Reports awaiting approval"
          count={cycle.reportsAwaitingApproval}
        />
        <BacklogTile
          label="Timesheets awaiting approval"
          count={cycle.timesheetsAwaitingApproval}
        />
        <BacklogTile
          label="Overdue reports (last week)"
          count={cycle.overdueReportsLastWeek}
          tone={cycle.overdueReportsLastWeek > 0 ? 'warning' : 'neutral'}
        />
        <BacklogTile
          label="Overdue timesheets (last week)"
          count={cycle.overdueTimesheetsLastWeek}
          tone={cycle.overdueTimesheetsLastWeek > 0 ? 'warning' : 'neutral'}
        />
      </div>
    </section>
  );
}

function BacklogTile({
  label,
  count,
  tone = 'neutral',
}: {
  label: string;
  count: number;
  tone?: 'neutral' | 'warning';
}) {
  const wrap = tone === 'warning'
    ? 'border-amber-200 bg-amber-50'
    : 'border-gray-200 bg-gray-50';
  const numTone = tone === 'warning' ? 'text-amber-900' : 'text-gray-900';
  return (
    <div className={'rounded-md border p-3 ' + wrap}>
      <div className={'text-xl font-semibold ' + numTone}>{count.toLocaleString()}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-600">
        {label}
      </div>
    </div>
  );
}

function RatesGrid({
  rows,
}: {
  rows: { label: string; rate: number | null; sub: string; icon: React.ReactNode }[];
}) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const widthPct = r.rate == null ? 0 : Math.max(2, Math.round(r.rate * 100));
        const barColor =
          r.rate == null
            ? 'bg-gray-200'
            : r.rate >= 0.8
              ? 'bg-emerald-500'
              : r.rate >= 0.5
                ? 'bg-amber-400'
                : 'bg-red-400';
        return (
          <li key={r.label}>
            <div className="mb-1 flex items-center gap-2 text-xs text-gray-600">
              <span className="text-accent">{r.icon}</span>
              <span className="font-medium">{r.label}</span>
              <span className="ml-auto text-xs font-semibold text-gray-900">
                {pct(r.rate)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className={'h-full ' + barColor} style={{ width: `${widthPct}%` }} />
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">{r.sub}</p>
          </li>
        );
      })}
    </ul>
  );
}

// ── Supervisor load ─────────────────────────────────────────────────────────

function SupervisorLoadCard({ rows }: { rows: SupervisorLoadRow[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-accent" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-900">Supervisor load</h2>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          No supervisors have active interns assigned.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Supervisor</th>
                <th className="px-2 py-2 text-right font-medium">Active interns</th>
                <th className="px-2 py-2 text-right font-medium">Reports to review</th>
                <th className="px-2 py-2 text-right font-medium">Timesheets to approve</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const heavy =
                  r.pendingReports + r.pendingTimesheets >= 5;
                return (
                  <tr
                    key={r.supervisorUserId ?? r.supervisorName}
                    className="border-t border-gray-100"
                  >
                    <td className="px-2 py-2 text-gray-900">
                      {r.supervisorName}
                      {r.supervisorUserId == null && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-900">
                      {r.activeInterns.toLocaleString()}
                    </td>
                    <td
                      className={
                        'px-2 py-2 text-right ' +
                        (heavy ? 'font-semibold text-amber-700' : 'text-gray-700')
                      }
                    >
                      {r.pendingReports.toLocaleString()}
                    </td>
                    <td
                      className={
                        'px-2 py-2 text-right ' +
                        (heavy ? 'font-semibold text-amber-700' : 'text-gray-700')
                      }
                    >
                      {r.pendingTimesheets.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-gray-100 bg-gray-50"
          />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-44 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
        <div className="h-44 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      </div>
      <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function pct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '—';
  return `${Math.round(rate * 100)}%`;
}
