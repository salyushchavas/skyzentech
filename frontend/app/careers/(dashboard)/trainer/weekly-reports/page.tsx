'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Lock,
  RotateCcw,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  ReviewWeeklyReportRequest,
  Uuid,
  WeeklyReportResponse,
  WeeklyReportStatus,
} from '@/types';

/**
 * Supervisor view: review weekly reports for the interns this supervisor
 * owns. Picks one intern at a time from the evaluator roster, lists their
 * reports, and surfaces Return-with-notes / Approve actions inline.
 *
 * Backed by:
 *   GET  /api/v1/supervised/evaluator/interns
 *   GET  /api/v1/weekly-reports/intern/{candidateId}
 *   POST /api/v1/weekly-reports/{id}/return
 *   POST /api/v1/weekly-reports/{id}/approve
 */
export default function SupervisorWeeklyReportsPage() {
  return (
    <ProtectedRoute requiredRoles={['TRAINER', 'SUPER_ADMIN']}>
      <DashboardLayout title="Weekly Reports">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

interface InternRow {
  candidateId: Uuid;
  name: string;
  position: string | null;
  entityName: string | null;
}

const STATUS_PILL: Record<WeeklyReportStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-sky-100 text-sky-800',
  RETURNED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
};

function Body() {
  const [interns, setInterns] = useState<InternRow[] | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [reports, setReports] = useState<WeeklyReportResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Load supervised interns once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<InternRow[]>('/api/v1/supervised/evaluator/interns');
        if (cancelled) return;
        setInterns(res.data ?? []);
        if ((res.data ?? []).length > 0 && !selectedCandidateId) {
          setSelectedCandidateId(res.data[0].candidateId);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.error ?? "Couldn't load your supervised interns.");
          setInterns([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReports = useCallback(async (candidateId: string) => {
    setError(null);
    setReports(null);
    try {
      const res = await api.get<WeeklyReportResponse[]>(
        `/api/v1/weekly-reports/intern/${candidateId}`,
      );
      setReports(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load reports for this intern.");
      setReports([]);
    }
  }, []);

  useEffect(() => {
    if (selectedCandidateId) void loadReports(selectedCandidateId);
  }, [selectedCandidateId, loadReports]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const selectedIntern = useMemo(
    () => interns?.find((i) => i.candidateId === selectedCandidateId) ?? null,
    [interns, selectedCandidateId],
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Weekly reports</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review your interns' weekly narratives. Return with notes for revisions or
          approve to lock the week.
        </p>
      </header>

      {toast && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Intern picker */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="h-4 w-4 text-gray-500" strokeWidth={2} />
          Intern:
          <select
            value={selectedCandidateId ?? ''}
            onChange={(e) => setSelectedCandidateId(e.target.value || null)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {interns === null ? (
              <option>Loading…</option>
            ) : interns.length === 0 ? (
              <option value="">No supervised interns</option>
            ) : (
              interns.map((it) => (
                <option key={it.candidateId} value={it.candidateId}>
                  {it.name}
                  {it.position ? ` — ${it.position}` : ''}
                </option>
              ))
            )}
          </select>
        </label>
        {selectedIntern && selectedIntern.entityName && (
          <span className="text-xs text-gray-500">at {selectedIntern.entityName}</span>
        )}
      </div>

      {/* Reports list */}
      {interns?.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No interns assigned to you yet.
        </div>
      ) : reports === null ? (
        <Skeleton />
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          This intern hasn't filed any reports yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              onReviewed={(msg) => {
                setToast(msg);
                if (selectedCandidateId) void loadReports(selectedCandidateId);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportRow({
  report,
  onReviewed,
}: {
  report: WeeklyReportResponse;
  onReviewed: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [busy, setBusy] = useState<'return' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locked = report.status === 'APPROVED';
  const canReview = report.status === 'SUBMITTED' || report.status === 'RETURNED';

  const callReview = async (
    action: 'return' | 'approve',
    body: ReviewWeeklyReportRequest | undefined,
  ) => {
    setBusy(action);
    setError(null);
    try {
      await api.post(`/api/v1/weekly-reports/${report.id}/${action}`, body ?? {});
      onReviewed(action === 'return' ? 'Returned for correction.' : 'Approved.');
      setReturnNotes('');
      setApproveNotes('');
      setExpanded(false);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't update the report.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Week of {formatDateOnly(report.weekStart)}
            </h3>
            <span
              className={
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                STATUS_PILL[report.status]
              }
            >
              {report.status}
            </span>
            {locked && <Lock className="h-3.5 w-3.5 text-emerald-700" strokeWidth={2} />}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {report.submittedAt && <>Submitted {formatRelative(report.submittedAt)}</>}
            {report.reviewedAt && (
              <>
                {' · '}
                {locked ? 'Approved' : 'Reviewed'} {formatRelative(report.reviewedAt)}
                {report.reviewedByName ? ` by ${report.reviewedByName}` : ''}
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {expanded ? 'Hide' : 'Open'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <FieldBlock label="Completed work" value={report.completedWork} />
          <FieldBlock label="Blockers" value={report.blockers} />
          <FieldBlock label="Learning outcomes" value={report.learningOutcomes} />
          <FieldBlock label="Plan for next week" value={report.nextPlan} />

          {report.reviewNotes && (
            <div
              className={
                'rounded-md border p-3 text-xs ' +
                (locked
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900')
              }
            >
              <span className="font-semibold">Last review note: </span>
              {report.reviewNotes}
            </div>
          )}

          {canReview && (
            <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Return with notes (required for return)
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="What needs to change before approval?"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={busy !== null || returnNotes.trim().length === 0}
                    onClick={() => void callReview('return', { reviewNotes: returnNotes })}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                    {busy === 'return' ? 'Returning…' : 'Return for correction'}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Approval note (optional)
                </label>
                <textarea
                  rows={2}
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Anything to highlight on approval?"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void callReview(
                        'approve',
                        approveNotes.trim() ? { reviewNotes: approveNotes } : undefined,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                    {busy === 'approve' ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}
            </div>
          )}

          {report.status === 'DRAFT' && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs italic text-gray-500">
              <ClipboardList className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
              Draft — the intern hasn't submitted yet.
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function FieldBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="whitespace-pre-wrap text-sm text-gray-800">
        {value && value.trim().length > 0 ? value : '—'}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-20 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="h-20 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="h-20 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
    </div>
  );
}
