'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import api from '@/lib/api';
import { formatDateOnly } from '@/lib/format-date';
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

const STATUS_COLOR: Record<AssignmentStatus, string> = {
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  SUBMITTED: 'bg-purple-100 text-purple-800',
  REVIEWED: 'bg-emerald-100 text-emerald-800',
};

function StatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        STATUS_COLOR[status]
      }
    >
      {status === 'REVIEWED' ? 'Reviewed ✓' : status.replace('_', ' ')}
    </span>
  );
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
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitFor, setSubmitFor] = useState<AssignmentResponse | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<AssignmentResponse[]>('/api/v1/supervised/my/assignments');
      setAssignments(res.data ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Couldn't load your assignments.";
      setError(msg);
      setAssignments([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">My Work</h1>
        <p className="mt-1 text-sm text-slate-600">
          Weekly assignments from your evaluator. Submit your work for review.
        </p>
      </header>

      {toast && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {assignments === null ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
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
                <StatusBadge status={a.status} />
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
                      // Best-effort: flip ASSIGNED -> IN_PROGRESS when the intern opens
                      // the submit modal. Failure is non-fatal (the submit endpoint
                      // also transitions status), so we don't await or surface errors.
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

      {submitFor && (
        <SubmitWorkModal
          assignment={submitFor}
          onClose={() => setSubmitFor(null)}
          onSubmitted={() => {
            setSubmitFor(null);
            setToast('Work submitted for review.');
            void load();
          }}
        />
      )}
    </section>
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
