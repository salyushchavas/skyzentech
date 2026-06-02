'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  Github,
  Video,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatRelative } from '@/lib/format-date';
import type { ReportingManagerDashboard, Uuid } from '@/types';

type CatalogAssignmentStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'TECH_APPROVED'
  | 'PENDING_VIVA'
  | 'COMPLETED';

interface CatalogAssignmentRow {
  id: Uuid;
  project: {
    id: Uuid;
    name: string;
    repository?: { repositoryName: string; repositoryUrl: string } | null;
  };
  intern: { id: Uuid; fullName: string; email: string; githubUsername?: string };
  status: CatalogAssignmentStatus;
  submittedAt?: string;
  submissionNotes?: string;
  updatedAt?: string;
}

export default function ReportingManagerDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['REPORTING_MANAGER', 'SUPER_ADMIN']}>
      <DashboardLayout title="Reporting Manager">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [data, setData] = useState<ReportingManagerDashboard | null>(null);
  const [catalogQueue, setCatalogQueue] = useState<CatalogAssignmentRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [res, q] = await Promise.all([
        api.get<ReportingManagerDashboard>('/api/v1/reporting-manager/dashboard'),
        // Catalog-flow assignments awaiting RM action. ?status=X&status=Y is the
        // axios serialisation for List<ProjectAssignmentStatus> on the backend.
        api.get<CatalogAssignmentRow[]>(
          '/api/v1/project-assignments/by-status?status=TECH_APPROVED&status=PENDING_VIVA',
        ),
      ]);
      setData(res.data);
      setCatalogQueue(q.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function markPendingViva(assignmentId: Uuid) {
    try {
      await api.post(`/api/v1/project-assignments/${assignmentId}/mark-pending-viva`);
      toast.success('Marked as pending viva.');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't update.");
    }
  }

  async function completeAfterViva(assignmentId: Uuid) {
    if (!confirm('Mark this assignment COMPLETED after the viva? This is final.')) return;
    try {
      await api.post(`/api/v1/project-assignments/${assignmentId}/complete-after-viva`);
      toast.success('Assignment completed.');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't complete.");
    }
  }

  async function returnForRevisions(assignmentId: Uuid) {
    const reason = window.prompt(
      'Reason for returning to the intern (10+ characters):',
      '',
    );
    if (reason == null) return;
    if (reason.trim().length < 10) {
      toast.error('Please give a reason of at least 10 characters.');
      return;
    }
    try {
      await api.post(`/api/v1/project-assignments/${assignmentId}/return-revisions`, {
        reason: reason.trim(),
      });
      toast.success('Returned for revisions.');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't return.");
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton />;
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!data) return null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">
          Reporting Manager
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Run vivas on tech-approved projects, sign off final completion, and
          approve your interns&apos; timesheets.
        </p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<CalendarClock className="h-5 w-5 text-indigo-600" />}
          label="Pending Q&As"
          value={data.pendingQaCount}
          hint="Projects awaiting a viva."
        />
        <StatCard
          icon={<ClipboardCheck className="h-5 w-5 text-amber-600" />}
          label="Pending timesheets"
          value={data.pendingTimesheetCount}
          hint="Submitted weeks awaiting approval."
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Completed this month"
          value={data.completedThisMonthCount}
          hint="Projects you signed off in this calendar month."
        />
      </div>

      {/* Projects awaiting Q&A */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Projects awaiting Q&amp;A
        </h2>
        {data.projectsAwaitingQa.length === 0 ? (
          <EmptyRow>No tech-approved projects pending Q&amp;A right now.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {data.projectsAwaitingQa.map((p) => (
              <li
                key={p.projectId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {p.projectTitle}
                  </div>
                  <div className="text-xs text-gray-500">
                    {p.internName ?? '—'}
                    {p.techApprovedAt && (
                      <> · tech-approved {formatRelative(p.techApprovedAt)}</>
                    )}
                  </div>
                </div>
                <Link
                  href={`/careers/reporting-manager/sessions/new?projectId=${p.projectId}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
                  Schedule Q&amp;A
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Q&A in progress */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Q&amp;A sessions in progress
        </h2>
        {data.qaInProgress.length === 0 ? (
          <EmptyRow>No active sessions.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {data.qaInProgress.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {s.projectTitle ?? 'Session'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.internName ?? '—'} · scheduled{' '}
                    {formatRelative(s.scheduledAt)} ·{' '}
                    <span
                      className={
                        s.status === 'CONDUCTED'
                          ? 'text-violet-700'
                          : 'text-indigo-700'
                      }
                    >
                      {s.status === 'CONDUCTED' ? 'Conducted' : 'Scheduled'}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/careers/reporting-manager/sessions/${s.id}`}
                  className="text-xs font-medium text-accent-dark hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Catalog-flow assignments awaiting viva */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Project assignments awaiting viva
        </h2>
        <p className="mb-2 text-xs text-gray-500">
          Tech-approved assignments from the new catalog flow. Run the viva offline
          (call, screen-share, walkthrough) and sign off here.
        </p>
        {catalogQueue === null ? (
          <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        ) : catalogQueue.length === 0 ? (
          <EmptyRow>No catalog-flow assignments waiting on you.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {catalogQueue.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {a.project.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.intern.fullName}
                      {a.intern.githubUsername && (
                        <span className="ml-1 font-mono text-gray-600">
                          (@{a.intern.githubUsername})
                        </span>
                      )}
                      {a.submittedAt && (
                        <> · submitted {formatRelative(a.submittedAt)}</>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
                          + (a.status === 'PENDING_VIVA'
                            ? 'bg-violet-100 text-violet-800'
                            : 'bg-indigo-100 text-indigo-800')
                        }
                      >
                        {a.status.replaceAll('_', ' ')}
                      </span>
                      {a.project.repository?.repositoryUrl && (
                        <a
                          href={a.project.repository.repositoryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-dark hover:underline"
                        >
                          <Github className="h-3 w-3" strokeWidth={2.5} />
                          {a.project.repository.repositoryName}
                          <ExternalLink className="h-3 w-3" strokeWidth={2} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.status === 'TECH_APPROVED' && (
                      <button
                        type="button"
                        onClick={() => void markPendingViva(a.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                        title="Mark as pending viva once you've scheduled it"
                      >
                        <Video className="h-3 w-3" strokeWidth={2.5} />
                        Mark pending viva
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void completeAfterViva(a.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      title="Sign off and mark COMPLETED"
                    >
                      <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => void returnForRevisions(a.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-orange-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-50"
                      title="Bounce back to the intern with a reason"
                    >
                      <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
                      Return
                    </button>
                  </div>
                </div>
                {a.submissionNotes && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-medium text-gray-600 hover:text-gray-800">
                      Submission notes
                    </summary>
                    <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2 text-[11px] text-gray-700">
                      {a.submissionNotes}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pending timesheets (top 5) */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Pending timesheet approvals
          </h2>
          {data.pendingTimesheetCount > 5 && (
            <Link
              href="/careers/reporting-manager/timesheets"
              className="text-xs font-medium text-accent-dark hover:underline"
            >
              See all →
            </Link>
          )}
        </div>
        {data.pendingTimesheets.length === 0 ? (
          <EmptyRow>No timesheets awaiting your review.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {data.pendingTimesheets.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {t.internName ?? '—'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Week of {t.weekStart} · {Number(t.totalHours).toFixed(1)} hrs
                  </div>
                </div>
                <Link
                  href={`/careers/reporting-manager/timesheets/${t.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{hint}</div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-center text-xs italic text-gray-500">
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-1/3 animate-pulse rounded bg-gray-100" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      </div>
      <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
