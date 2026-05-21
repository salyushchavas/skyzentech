'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, Plus } from 'lucide-react';
import api from '@/lib/api';
import { formatDateOnly } from '@/lib/format-date';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import type { Uuid } from '@/types';

interface InternSummaryResponse {
  candidateId: Uuid;
  name: string | null;
  email: string | null;
  position: string | null;
  entityName: string | null;
  hiredDate: string | null;
  assignedEvaluatorName: string | null;
}

type AssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVIEWED';

interface AssignmentResponse {
  id: Uuid;
  title: string;
  description: string | null;
  weekOf: string; // LocalDate ISO
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

export default function SupervisedInternDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'TECHNICAL_EVALUATOR', 'HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="Supervised Intern">
        <InternDetail />
      </DashboardLayout>
    </ProtectedRoute>
  );
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

function InternDetail() {
  const params = useParams<{ candidateId: string }>();
  const candidateId = params?.candidateId;

  const [intern, setIntern] = useState<InternSummaryResponse | null>(null);
  const [internLoaded, setInternLoaded] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const loadIntern = useCallback(async () => {
    if (!candidateId) return;
    try {
      const res = await api.get<InternSummaryResponse[]>('/api/v1/supervised/interns');
      const found = (res.data ?? []).find((i) => i.candidateId === candidateId) ?? null;
      setIntern(found);
    } catch {
      setIntern(null);
    } finally {
      setInternLoaded(true);
    }
  }, [candidateId]);

  const loadAssignments = useCallback(async () => {
    if (!candidateId) return;
    setError(null);
    try {
      const res = await api.get<AssignmentResponse[]>(
        `/api/v1/supervised/interns/${candidateId}/assignments`,
      );
      setAssignments(res.data ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Couldn't load assignments.";
      setError(msg);
      setAssignments([]);
    }
  }, [candidateId]);

  useEffect(() => {
    void loadIntern();
    void loadAssignments();
  }, [loadIntern, loadAssignments]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <section>
      <Link
        href="/careers/supervised"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Supervised Interns
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          {intern?.name ?? (internLoaded ? 'Intern not found' : 'Loading…')}
        </h1>
        {intern?.position ? (
          <p className="mt-1 text-sm text-slate-600">
            {intern.position}
            {intern.entityName ? <> · {intern.entityName}</> : null}
          </p>
        ) : null}
      </header>

      {toast && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            New Assignment
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {assignments === null ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-gray-400" strokeWidth={1.5} />
            <p className="text-sm text-gray-600">No assignments yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {assignments.map((a) => (
              <AssignmentRow
                key={a.id}
                assignment={a}
                onReviewed={(msg) => {
                  setToast(msg);
                  void loadAssignments();
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {showNew && candidateId && (
        <NewAssignmentModal
          candidateId={candidateId}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            setToast('Assignment created.');
            void loadAssignments();
          }}
        />
      )}
    </section>
  );
}

function AssignmentRow({
  assignment,
  onReviewed,
}: {
  assignment: AssignmentResponse;
  onReviewed: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const isSubmitted = assignment.status === 'SUBMITTED';
  const isReviewed = assignment.status === 'REVIEWED';

  const submitReview = async () => {
    if (!note.trim()) {
      setReviewError('Please write a review note.');
      return;
    }
    setSubmitting(true);
    setReviewError(null);
    try {
      await api.post(`/api/v1/supervised/assignments/${assignment.id}/review`, {
        reviewNote: note.trim(),
      });
      setReviewOpen(false);
      setNote('');
      onReviewed('Marked as reviewed.');
    } catch (err: any) {
      setReviewError(err?.response?.data?.error ?? 'Could not mark reviewed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-left font-semibold text-gray-900 hover:underline"
        >
          {assignment.title}
        </button>
        <StatusBadge status={assignment.status} />
      </div>
      <div className="text-xs text-gray-500">
        Week of {formatDateOnly(assignment.weekOf)} · Due {formatDateOnly(assignment.dueDate)}
        {assignment.assignedByName ? <> · By {assignment.assignedByName}</> : null}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-sm">
          {assignment.description && (
            <div className="whitespace-pre-wrap text-gray-700">{assignment.description}</div>
          )}
          {(isSubmitted || isReviewed) && (
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Submission
              </div>
              {assignment.submissionText && (
                <p className="whitespace-pre-wrap text-gray-800">{assignment.submissionText}</p>
              )}
              {assignment.submissionLink && (
                <a
                  href={assignment.submissionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block break-all text-xs text-accent hover:underline"
                >
                  {assignment.submissionLink}
                </a>
              )}
              {assignment.submittedAt && (
                <div className="mt-1 text-xs text-gray-500">
                  Submitted {formatDateOnly(assignment.submittedAt)}
                </div>
              )}
            </div>
          )}
          {isReviewed && assignment.reviewNote && (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Reviewer note
              </div>
              <p className="whitespace-pre-wrap">{assignment.reviewNote}</p>
            </div>
          )}
        </div>
      )}

      {isSubmitted && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!reviewOpen ? (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Review
            </button>
          ) : (
            <div className="w-full space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Review note for the intern…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {reviewError && (
                <div className="text-xs text-red-600">{reviewError}</div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={submitting}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : 'Mark Reviewed'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewOpen(false);
                    setNote('');
                    setReviewError(null);
                  }}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function NewAssignmentModal({
  candidateId,
  onClose,
  onCreated,
}: {
  candidateId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weekOf, setWeekOf] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || !weekOf || !dueDate) {
      setError('Title, week of, and due date are required.');
      return;
    }
    if (dueDate < weekOf) {
      setError('Due date cannot be before the week-of date.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/v1/supervised/interns/${candidateId}/assignments`, {
        title: title.trim(),
        description: description.trim() || null,
        weekOf,
        dueDate,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not create assignment.');
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
        <h3 className="mb-4 text-lg font-semibold text-gray-900">New assignment</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Week of <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={weekOf}
                onChange={(e) => setWeekOf(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Due date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
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
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
