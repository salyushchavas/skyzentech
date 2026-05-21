'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, ClipboardList, Clock, Plus, Star } from 'lucide-react';
import api from '@/lib/api';
import { formatDateOnly, formatFull } from '@/lib/format-date';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import type { Uuid } from '@/types';

type AssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVIEWED';

interface AssignmentResponse {
  id: Uuid;
  title: string;
  description: string | null;
  weekOf: string;
  dueDate: string;
  status: AssignmentStatus;
  submissionText: string | null;
  submissionLink: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  assignedByName: string | null;
  createdAt: string;
}

type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

interface TimesheetResponse {
  id: Uuid;
  weekStart: string;
  hours: number | string;
  description: string | null;
  status: TimesheetStatus;
  approvedByName: string | null;
  approvedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

interface TimesheetListResponse {
  entries: TimesheetResponse[];
  totalApprovedHours: number | string;
}

type EvaluationStatus = 'SCHEDULED' | 'COMPLETED' | 'MISSED';

interface EvaluationSessionResponse {
  id: Uuid;
  scheduledAt: string;
  status: EvaluationStatus;
  evaluatorName: string | null;
  evaluatorId: Uuid | null;
  overallRating: number | null;
  strengths: string | null;
  areasForImprovement: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface SupervisedOverviewResponse {
  totalApprovedHours: number | string | null;
  openAssignments: number | null;
  reviewedAssignments: number | null;
  nextEvaluation: {
    scheduledAt: string | null;
    evaluatorName: string | null;
  } | null;
  latestEvaluation: {
    overallRating: number | null;
    completedAt: string | null;
  } | null;
  evaluatorName: string | null;
}

const ASSIGNMENT_COLOR: Record<AssignmentStatus, string> = {
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  SUBMITTED: 'bg-purple-100 text-purple-800',
  REVIEWED: 'bg-emerald-100 text-emerald-800',
};

const TIMESHEET_COLOR: Record<TimesheetStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-purple-100 text-purple-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const EVALUATION_COLOR: Record<EvaluationStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  MISSED: 'bg-gray-100 text-gray-700',
};

function EvaluationBadge({ status }: { status: EvaluationStatus }) {
  const labels: Record<EvaluationStatus, string> = {
    SCHEDULED: 'Scheduled',
    COMPLETED: 'Completed ✓',
    MISSED: 'Missed',
  };
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        EVALUATION_COLOR[status]
      }
    >
      {labels[status]}
    </span>
  );
}

function StarRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <Star
            key={n}
            className={filled ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
            style={{ width: size, height: size }}
            strokeWidth={1.5}
          />
        );
      })}
    </div>
  );
}

function AssignmentBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        ASSIGNMENT_COLOR[status]
      }
    >
      {status === 'REVIEWED' ? 'Reviewed ✓' : status.replace('_', ' ')}
    </span>
  );
}

function TimesheetBadge({ status }: { status: TimesheetStatus }) {
  const labels: Record<TimesheetStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved ✓',
    REJECTED: 'Rejected',
  };
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        TIMESHEET_COLOR[status]
      }
    >
      {labels[status]}
    </span>
  );
}

function formatHours(h: number | string | null | undefined): string {
  if (h === null || h === undefined) return '0';
  const n = typeof h === 'number' ? h : Number(h);
  if (Number.isNaN(n)) return String(h);
  // Drop the trailing ".00" when the value is whole.
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

export default function MyWorkPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="My Work">
        <MyWorkList />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function MyWorkList() {
  const [assignments, setAssignments] = useState<AssignmentResponse[] | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitFor, setSubmitFor] = useState<AssignmentResponse | null>(null);

  const [timesheets, setTimesheets] = useState<TimesheetListResponse | null>(null);
  const [timesheetError, setTimesheetError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState<TimesheetResponse | null>(null);

  const [sessions, setSessions] = useState<EvaluationSessionResponse[] | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [overview, setOverview] = useState<SupervisedOverviewResponse | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    setAssignmentError(null);
    try {
      const res = await api.get<AssignmentResponse[]>('/api/v1/supervised/my/assignments');
      setAssignments(res.data ?? []);
    } catch (err: any) {
      setAssignmentError(err?.response?.data?.error ?? "Couldn't load your assignments.");
      setAssignments([]);
    }
  }, []);

  const loadTimesheets = useCallback(async () => {
    setTimesheetError(null);
    try {
      const res = await api.get<TimesheetListResponse>('/api/v1/supervised/my/timesheets');
      setTimesheets(res.data ?? { entries: [], totalApprovedHours: 0 });
    } catch (err: any) {
      setTimesheetError(err?.response?.data?.error ?? "Couldn't load your timesheets.");
      setTimesheets({ entries: [], totalApprovedHours: 0 });
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionError(null);
    try {
      const res = await api.get<EvaluationSessionResponse[]>('/api/v1/supervised/my/evaluations');
      setSessions(res.data ?? []);
    } catch (err: any) {
      setSessionError(err?.response?.data?.error ?? "Couldn't load your evaluations.");
      setSessions([]);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setOverviewError(null);
    try {
      const res = await api.get<SupervisedOverviewResponse>('/api/v1/supervised/my/overview');
      setOverview(res.data ?? null);
    } catch (err: any) {
      setOverviewError(err?.response?.data?.error ?? "Couldn't load your overview.");
      setOverview(null);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
    void loadTimesheets();
    void loadSessions();
    void loadOverview();
  }, [loadAssignments, loadTimesheets, loadSessions, loadOverview]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const resubmit = async (t: TimesheetResponse) => {
    try {
      await api.post(`/api/v1/supervised/timesheets/${t.id}/submit`);
      setToast('Timesheet resubmitted.');
      void loadTimesheets();
    } catch (err: any) {
      setToast(err?.response?.data?.error ?? 'Could not resubmit.');
    }
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">My Work</h1>
        <p className="mt-1 text-sm text-slate-600">
          Weekly assignments from your evaluator, plus your timesheets.
        </p>
      </header>

      {toast && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      )}

      {/* Summary header — at-a-glance overview. Renders zeros + "—" cleanly
          for candidates with no hired-intern data. */}
      <OverviewHeader overview={overview} error={overviewError} />

      {/* Assignments */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Assignments</h2>

        {assignmentError && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {assignmentError}
          </div>
        )}

        {assignments === null ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-gray-400" strokeWidth={1.5} />
            <p className="text-sm text-gray-600">No assignments yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {assignments.map((a) => (
              <li key={a.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-gray-900">{a.title}</div>
                  <AssignmentBadge status={a.status} />
                </div>
                <div className="text-xs text-gray-500">
                  Week of {formatDateOnly(a.weekOf)} · Due {formatDateOnly(a.dueDate)}
                  {a.assignedByName ? <> · From {a.assignedByName}</> : null}
                </div>
                {a.description && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{a.description}</p>
                )}

                {(a.status === 'SUBMITTED' || a.status === 'REVIEWED') && (
                  <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Your submission
                    </div>
                    {a.submissionText && (
                      <p className="whitespace-pre-wrap text-gray-800">{a.submissionText}</p>
                    )}
                    {a.submissionLink && (
                      <a
                        href={a.submissionLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block break-all text-xs text-accent hover:underline"
                      >
                        {a.submissionLink}
                      </a>
                    )}
                  </div>
                )}

                {a.status === 'REVIEWED' && a.reviewNote && (
                  <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Reviewer note
                    </div>
                    <p className="whitespace-pre-wrap">{a.reviewNote}</p>
                  </div>
                )}

                {(a.status === 'ASSIGNED' || a.status === 'IN_PROGRESS') && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (a.status === 'ASSIGNED') {
                          void api.post(`/api/v1/supervised/assignments/${a.id}/start`);
                        }
                        setSubmitFor(a);
                      }}
                      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
                    >
                      Submit work
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Timesheets */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Timesheets</h2>
            <p className="text-xs text-gray-500">
              Total approved:{' '}
              <span className="font-medium text-gray-900">
                {formatHours(timesheets?.totalApprovedHours ?? 0)} hrs
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowLog(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            Log hours
          </button>
        </div>

        {timesheetError && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {timesheetError}
          </div>
        )}

        {timesheets === null ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : timesheets.entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <Clock className="mx-auto mb-3 h-8 w-8 text-gray-400" strokeWidth={1.5} />
            <p className="text-sm text-gray-600">No hours logged yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {timesheets.entries.map((t) => (
              <li key={t.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-gray-900">
                    Week of {formatDateOnly(t.weekStart)} ·{' '}
                    <span className="font-normal text-gray-700">{formatHours(t.hours)} hrs</span>
                  </div>
                  <TimesheetBadge status={t.status} />
                </div>
                {t.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{t.description}</p>
                )}

                {t.status === 'APPROVED' && (
                  <div className="mt-2 text-xs text-gray-500">
                    Approved
                    {t.approvedByName ? <> by {t.approvedByName}</> : null}
                    {t.approvedAt ? <> · {formatDateOnly(t.approvedAt)}</> : null}
                  </div>
                )}

                {t.status === 'REJECTED' && t.reviewNote && (
                  <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                      Reason
                    </div>
                    <p className="whitespace-pre-wrap">{t.reviewNote}</p>
                  </div>
                )}

                {(t.status === 'DRAFT' || t.status === 'REJECTED') && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(t);
                        setShowLog(true);
                      }}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void resubmit(t)}
                      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
                    >
                      {t.status === 'REJECTED' ? 'Resubmit' : 'Submit'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Evaluations (read-only) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Evaluations</h2>

        {sessionError && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {sessionError}
          </div>
        )}

        {sessions === null ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <CalendarClock className="mx-auto mb-3 h-8 w-8 text-gray-400" strokeWidth={1.5} />
            <p className="text-sm text-gray-600">No evaluation sessions yet.</p>
          </div>
        ) : (
          <>
            <UpcomingSessionBanner sessions={sessions} />
            <ul className="space-y-3">
              {sessions
                .filter((s) => s.status !== 'SCHEDULED')
                .map((s) => (
                  <li key={s.id} className="rounded-lg border border-gray-200 bg-white p-5">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900">
                        {formatDateOnly(s.scheduledAt)}
                        {s.evaluatorName ? (
                          <span className="font-normal text-gray-600"> · {s.evaluatorName}</span>
                        ) : null}
                      </div>
                      <EvaluationBadge status={s.status} />
                    </div>
                    {s.status === 'COMPLETED' && (
                      <div className="mt-3 space-y-2 text-sm">
                        {s.overallRating != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Rating
                            </span>
                            <StarRow value={s.overallRating} />
                          </div>
                        )}
                        {s.strengths && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Strengths
                            </div>
                            <p className="whitespace-pre-wrap text-gray-800">{s.strengths}</p>
                          </div>
                        )}
                        {s.areasForImprovement && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Areas for improvement
                            </div>
                            <p className="whitespace-pre-wrap text-gray-800">
                              {s.areasForImprovement}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>

      {submitFor && (
        <SubmitWorkModal
          assignment={submitFor}
          onClose={() => setSubmitFor(null)}
          onSubmitted={() => {
            setSubmitFor(null);
            setToast('Work submitted for review.');
            void loadAssignments();
          }}
        />
      )}

      {showLog && (
        <LogHoursModal
          editing={editing}
          onClose={() => {
            setShowLog(false);
            setEditing(null);
          }}
          onSaved={(msg) => {
            setShowLog(false);
            setEditing(null);
            setToast(msg);
            void loadTimesheets();
          }}
        />
      )}
    </section>
  );
}

function OverviewHeader({
  overview,
  error,
}: {
  overview: SupervisedOverviewResponse | null;
  error: string | null;
}) {
  // Defensive UI: never assume the response shape is complete. Optional-chain
  // everything; render "—" when a value is missing or null.
  const totalApprovedHours = (() => {
    const raw = overview?.totalApprovedHours;
    if (raw === null || raw === undefined) return 0;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isNaN(n) ? 0 : n;
  })();
  const openAssignments = overview?.openAssignments ?? 0;

  const nextEvalDate = overview?.nextEvaluation?.scheduledAt ?? null;
  const nextEvalEvaluator = overview?.nextEvaluation?.evaluatorName ?? null;
  const latestRating = overview?.latestEvaluation?.overallRating ?? null;
  const evaluatorName = overview?.evaluatorName ?? null;

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Approved hours"
          value={overview === null ? '—' : `${formatHours(totalApprovedHours)} hrs`}
        />
        <StatCard
          label="Open assignments"
          value={overview === null ? '—' : String(openAssignments)}
        />
        <StatCard
          label="Next eval"
          value={overview === null || !nextEvalDate ? '—' : formatDateOnly(nextEvalDate)}
          hint={nextEvalEvaluator ? `with ${nextEvalEvaluator}` : undefined}
        />
        <StatCard
          label="Latest rating"
          value={
            overview === null || latestRating === null ? (
              '—'
            ) : (
              <StarRow value={latestRating} />
            )
          }
        />
      </div>
      <p className="mt-3 text-sm text-gray-600">
        Evaluator:{' '}
        <span className="font-medium text-gray-900">
          {overview === null ? '—' : evaluatorName ?? '— unassigned'}
        </span>
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function UpcomingSessionBanner({ sessions }: { sessions: EvaluationSessionResponse[] }) {
  const now = Date.now();
  // Earliest SCHEDULED session in the future. List is ordered DESC, so we
  // re-filter and pick the soonest manually.
  const upcoming = sessions
    .filter((s) => s.status === 'SCHEDULED' && new Date(s.scheduledAt).getTime() >= now)
    .sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )[0];
  if (!upcoming) return null;
  return (
    <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
      <span className="font-medium">Upcoming:</span> {formatFull(upcoming.scheduledAt)}
      {upcoming.evaluatorName ? <> with {upcoming.evaluatorName}</> : null}
    </div>
  );
}

function SubmitWorkModal({
  assignment,
  onClose,
  onSubmitted,
}: {
  assignment: AssignmentResponse;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [submissionText, setSubmissionText] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!submissionText.trim()) {
      setError('Please describe what you did.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/v1/supervised/assignments/${assignment.id}/submit`, {
        submissionText: submissionText.trim(),
        submissionLink: submissionLink.trim() || null,
      });
      onSubmitted();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not submit your work.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-lg font-semibold text-gray-900">Submit work</h3>
        <p className="mb-4 text-xs text-gray-500">{assignment.title}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes / summary <span className="text-red-500">*</span>
            </label>
            <textarea
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Link (optional)</label>
            <input
              type="url"
              value={submissionLink}
              onChange={(e) => setSubmissionLink(e.target.value)}
              placeholder="https://github.com/…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogHoursModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: TimesheetResponse | null;
  onClose: () => void;
  onSaved: (toast: string) => void;
}) {
  const [weekStart, setWeekStart] = useState(editing?.weekStart ?? '');
  const [hours, setHours] = useState(
    editing?.hours !== undefined && editing?.hours !== null ? String(editing.hours) : '',
  );
  const [description, setDescription] = useState(editing?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);

  const validate = (): { ok: boolean; hoursValue?: number } => {
    if (!editing && !weekStart) {
      setError('Week start is required.');
      return { ok: false };
    }
    const h = Number(hours);
    if (!hours || Number.isNaN(h)) {
      setError('Hours is required.');
      return { ok: false };
    }
    if (h <= 0 || h > 168) {
      setError('Hours must be greater than 0 and at most 168.');
      return { ok: false };
    }
    setError(null);
    return { ok: true, hoursValue: h };
  };

  const save = async (submitFlag: boolean) => {
    const v = validate();
    if (!v.ok) return;
    setBusy(submitFlag ? 'submit' : 'draft');
    try {
      if (editing) {
        await api.put(`/api/v1/supervised/timesheets/${editing.id}`, {
          hours: v.hoursValue,
          description: description.trim() || null,
        });
        if (submitFlag) {
          await api.post(`/api/v1/supervised/timesheets/${editing.id}/submit`);
        }
        onSaved(submitFlag ? 'Timesheet submitted.' : 'Draft saved.');
      } else {
        await api.post('/api/v1/supervised/my/timesheets', {
          weekStart,
          hours: v.hoursValue,
          description: description.trim() || null,
          submit: submitFlag,
        });
        onSaved(submitFlag ? 'Timesheet submitted.' : 'Draft saved.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not save the timesheet.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {editing ? 'Edit hours' : 'Log hours'}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Week starting <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              disabled={!!editing}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Hours <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.5"
              max="168"
              step="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              What you worked on
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={busy !== null}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {busy === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={busy !== null}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {busy === 'submit' ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
