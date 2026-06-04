'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Lock,
  Plus,
  Send,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import StageLockedEmpty from '@/components/candidate/StageLockedEmpty';
import { useAuth } from '@/lib/auth-context';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  CreateWeeklyReportRequest,
  UpdateWeeklyReportRequest,
  WeeklyReportResponse,
  WeeklyReportStatus,
} from '@/types';

/**
 * Intern view of weekly narrative reports. Phase-2 weekly cycle.
 * Backed by /api/v1/weekly-reports (POST, PUT, GET /me). The active-
 * engagement gate is enforced server-side; on 403 we render the same soft
 * "available when your internship starts" state the materials page uses.
 *
 * APPROVED reports lock the form — fields render read-only with a small
 * banner. RETURNED reports surface the reviewer's notes at the top.
 */
export default function CandidateWeeklyReportsPage() {
  // Widened so APPLICANTs land here and see the stage-locked empty state
  // instead of bouncing back to /careers/candidate.
  return (
    <ProtectedRoute requiredRoles={['INTERN', 'APPLICANT']}>
      <DashboardLayout title="Weekly Reports">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function ApplicantLockedReports() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Weekly reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Where you'll summarise your week's work once your internship is active.
        </p>
      </header>
      <StageLockedEmpty
        icon={FileText}
        title="Weekly reports unlock after hiring"
        body="Once active, you'll submit a weekly report summarizing your work."
        ctaHref="/careers/candidate/onboarding"
        ctaLabel="Continue onboarding"
      />
    </section>
  );
}

const STATUS_PILL: Record<WeeklyReportStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-sky-100 text-sky-800',
  RETURNED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
};

function Body() {
  const { user } = useAuth();
  if (user && !user.roles?.includes('INTERN')) {
    return <ApplicantLockedReports />;
  }
  return <InternReportsBody />;
}

function InternReportsBody() {
  const [reports, setReports] = useState<WeeklyReportResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsActiveEngagement, setNeedsActiveEngagement] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setNeedsActiveEngagement(false);
    try {
      const res = await api.get<WeeklyReportResponse[]>('/api/v1/weekly-reports/me');
      setReports(res.data ?? []);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setNeedsActiveEngagement(true);
        setReports(null);
        return;
      }
      setError(err?.response?.data?.error ?? "Couldn't load your reports.");
      setReports(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editingReport = useMemo(
    () => (editingId ? reports?.find((r) => r.id === editingId) ?? null : null),
    [editingId, reports],
  );

  if (needsActiveEngagement) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-sm text-blue-900">
        <FileText className="mb-2 h-6 w-6 text-blue-600" strokeWidth={1.75} />
        <p className="font-medium">Weekly reports are part of your active internship.</p>
        <p className="mt-1 text-blue-800">
          Once your engagement goes active, you'll be able to log a weekly report alongside
          your timesheet. Check back after onboarding wraps.
        </p>
      </div>
    );
  }
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
  if (reports === null) {
    return <Skeleton />;
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Weekly reports</h1>
          <p className="mt-1 text-sm text-gray-600">
            One report per week. Submit for supervisor review; approved reports lock.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          New report
        </button>
      </header>

      {showForm && !editingReport && (
        <NewReportForm
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      {editingReport && (
        <EditReportForm
          report={editingReport}
          onCancel={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            void load();
          }}
        />
      )}

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No reports yet. Click "New report" to log your first week.
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Week of {formatDateOnly(r.weekStart)}
                    </h3>
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                        STATUS_PILL[r.status]
                      }
                    >
                      {r.status}
                    </span>
                    {r.status === 'APPROVED' && (
                      <Lock className="h-3.5 w-3.5 text-emerald-700" strokeWidth={2} />
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {r.submittedAt && (
                      <>Submitted {formatRelative(r.submittedAt)}</>
                    )}
                    {r.reviewedAt && (
                      <>
                        {' · '}
                        {r.status === 'APPROVED' ? 'Approved' : 'Reviewed'}{' '}
                        {formatRelative(r.reviewedAt)}
                        {r.reviewedByName ? ` by ${r.reviewedByName}` : ''}
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(r.id);
                  }}
                  className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {r.status === 'APPROVED' ? 'View' : 'Open'}
                </button>
              </div>

              {r.status === 'RETURNED' && r.reviewNotes && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <div>
                    <span className="font-semibold">Reviewer asked for changes: </span>
                    {r.reviewNotes}
                  </div>
                </div>
              )}
              {r.status === 'APPROVED' && r.reviewNotes && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <div>
                    <span className="font-semibold">Reviewer note: </span>
                    {r.reviewNotes}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── New / edit forms ────────────────────────────────────────────────────────

function NewReportForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [weekStart, setWeekStart] = useState<string>(mondayOfThisWeek());
  const [completedWork, setCompletedWork] = useState('');
  const [blockers, setBlockers] = useState('');
  const [learningOutcomes, setLearningOutcomes] = useState('');
  const [nextPlan, setNextPlan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (alsoSubmit: boolean) => {
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateWeeklyReportRequest = {
        weekStart,
        completedWork: completedWork || undefined,
        blockers: blockers || undefined,
        learningOutcomes: learningOutcomes || undefined,
        nextPlan: nextPlan || undefined,
      };
      const res = await api.post<WeeklyReportResponse>(
        '/api/v1/weekly-reports',
        body,
      );
      if (alsoSubmit) {
        await api.put(`/api/v1/weekly-reports/${res.data.id}`, { submit: true });
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't save the report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
      className="rounded-lg border border-gray-200 bg-white p-5"
    >
      <h2 className="mb-4 text-sm font-semibold text-gray-900">New weekly report</h2>
      <FormFields
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        completedWork={completedWork}
        setCompletedWork={setCompletedWork}
        blockers={blockers}
        setBlockers={setBlockers}
        learningOutcomes={learningOutcomes}
        setLearningOutcomes={setLearningOutcomes}
        nextPlan={nextPlan}
        setNextPlan={setNextPlan}
        readOnly={false}
      />
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={() => void save(true)}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          Save and submit
        </button>
      </div>
    </form>
  );
}

function EditReportForm({
  report,
  onCancel,
  onSaved,
}: {
  report: WeeklyReportResponse;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const locked = report.status === 'APPROVED';
  const [weekStart, setWeekStart] = useState(report.weekStart);
  const [completedWork, setCompletedWork] = useState(report.completedWork ?? '');
  const [blockers, setBlockers] = useState(report.blockers ?? '');
  const [learningOutcomes, setLearningOutcomes] = useState(report.learningOutcomes ?? '');
  const [nextPlan, setNextPlan] = useState(report.nextPlan ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (alsoSubmit: boolean) => {
    if (locked) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: UpdateWeeklyReportRequest = {
        weekStart,
        completedWork,
        blockers,
        learningOutcomes,
        nextPlan,
        submit: alsoSubmit || undefined,
      };
      await api.put(`/api/v1/weekly-reports/${report.id}`, body);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't save the report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void save(false);
      }}
      className="rounded-lg border border-gray-200 bg-white p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Week of {formatDateOnly(report.weekStart)}
        </h2>
        {locked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            <Lock className="h-3 w-3" strokeWidth={2} />
            Locked
          </span>
        )}
      </div>
      <FormFields
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        completedWork={completedWork}
        setCompletedWork={setCompletedWork}
        blockers={blockers}
        setBlockers={setBlockers}
        learningOutcomes={learningOutcomes}
        setLearningOutcomes={setLearningOutcomes}
        nextPlan={nextPlan}
        setNextPlan={setNextPlan}
        readOnly={locked}
      />
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
        {!locked && (
          <>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={2} />
              {report.status === 'RETURNED' ? 'Resubmit' : 'Save and submit'}
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function FormFields(props: {
  weekStart: string;
  setWeekStart: (v: string) => void;
  completedWork: string;
  setCompletedWork: (v: string) => void;
  blockers: string;
  setBlockers: (v: string) => void;
  learningOutcomes: string;
  setLearningOutcomes: (v: string) => void;
  nextPlan: string;
  setNextPlan: (v: string) => void;
  readOnly: boolean;
}) {
  const baseInput =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-50 disabled:text-gray-500';
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Week start (Monday)
        </label>
        <input
          type="date"
          value={props.weekStart}
          onChange={(e) => props.setWeekStart(e.target.value)}
          disabled={props.readOnly}
          className={baseInput}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          What I completed this week
        </label>
        <textarea
          rows={3}
          value={props.completedWork}
          onChange={(e) => props.setCompletedWork(e.target.value)}
          disabled={props.readOnly}
          className={baseInput}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Blockers</label>
        <textarea
          rows={2}
          value={props.blockers}
          onChange={(e) => props.setBlockers(e.target.value)}
          disabled={props.readOnly}
          className={baseInput}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Learning outcomes
        </label>
        <textarea
          rows={2}
          value={props.learningOutcomes}
          onChange={(e) => props.setLearningOutcomes(e.target.value)}
          disabled={props.readOnly}
          className={baseInput}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Plan for next week
        </label>
        <textarea
          rows={2}
          value={props.nextPlan}
          onChange={(e) => props.setNextPlan(e.target.value)}
          disabled={props.readOnly}
          className={baseInput}
        />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-72 animate-pulse rounded bg-gray-100" />
      <div className="h-24 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="h-24 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
    </div>
  );
}

/** Last-Monday-from-today as a YYYY-MM-DD string for the week-start picker default. */
function mondayOfThisWeek(): string {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun .. 6=Sat
  // Calendar weeks per ISO: Monday is day 1. JS Sunday=0 → roll back 6, others → roll back (dow-1).
  const back = dow === 0 ? 6 : dow - 1;
  today.setDate(today.getDate() - back);
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

