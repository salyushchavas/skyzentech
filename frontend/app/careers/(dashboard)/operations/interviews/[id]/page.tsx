'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Mail, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ApplicationStatusBadge from '@/components/ApplicationStatusBadge';
import InterviewStatusBadge from '@/components/interviews/InterviewStatusBadge';
import FeedbackForm from '@/components/interviews/FeedbackForm';
import { formatFull } from '@/lib/format-date';
import type {
  InterviewRecommendation,
  InterviewResponse,
  UserRole,
} from '@/types';

const READ_ROLES: UserRole[] = [
  'OPERATIONS',
  'OPERATIONS',
  'OPERATIONS',
  'HR',
  'TECHNICAL_EVALUATOR',
];
const ADMIN_ERM: UserRole[] = ['OPERATIONS'];

const TYPE_LABEL: Record<string, string> = {
  INITIAL_SCREEN: 'Initial Screen',
  TECHNICAL: 'Technical',
  BEHAVIORAL: 'Behavioral',
  CULTURE_FIT: 'Culture Fit',
  FINAL_ROUND: 'Final Round',
};

const RECOMMENDATION_LABEL: Record<InterviewRecommendation, string> = {
  STRONG_HIRE: 'Strong Hire',
  HIRE: 'Hire',
  NO_HIRE: 'No Hire',
  STRONG_NO_HIRE: 'Strong No Hire',
};

const RECOMMENDATION_COLOR: Record<InterviewRecommendation, string> = {
  STRONG_HIRE: 'bg-green-100 text-green-800',
  HIRE: 'bg-teal-100 text-teal-800',
  NO_HIRE: 'bg-amber-100 text-amber-800',
  STRONG_NO_HIRE: 'bg-red-100 text-red-700',
};

export default function InterviewDetailPage() {
  return (
    <ProtectedRoute requiredRoles={READ_ROLES}>
      <DashboardLayout title="Interview Details">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null;
  const { user } = useAuth();

  const [interview, setInterview] = useState<InterviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [statusBusy, setStatusBusy] = useState<'CANCELLED' | 'NO_SHOW' | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<InterviewResponse>(`/api/v1/interviews/${id}`);
      setInterview(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not load interview');
      setInterview(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAdminErm = useMemo(
    () => user?.roles?.some((r) => ADMIN_ERM.includes(r)) ?? false,
    [user]
  );
  const isInterviewer = useMemo(
    () =>
      Boolean(
        interview?.interviewerId &&
          user?.userId &&
          interview.interviewerId === user.userId
      ),
    [interview, user]
  );
  const canSubmitFeedback = isAdminErm || isInterviewer;

  async function updateStatus(target: 'CANCELLED' | 'NO_SHOW') {
    if (!id) return;
    if (typeof window !== 'undefined') {
      const msg =
        target === 'CANCELLED'
          ? 'Cancel this interview? This cannot be undone.'
          : 'Mark this interview as a no-show?';
      if (!window.confirm(msg)) return;
    }
    setStatusBusy(target);
    try {
      const res = await api.patch<InterviewResponse>(
        `/api/v1/interviews/${id}/status`,
        { status: target }
      );
      setInterview(res.data);
      toast.success(target === 'CANCELLED' ? 'Interview cancelled' : 'Marked as no-show');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Status update failed');
    } finally {
      setStatusBusy(null);
    }
  }

  if (loading) return <DetailSkeleton />;

  if (error && !interview) {
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

  if (!interview) {
    return <div className="text-sm text-gray-500">Interview not found.</div>;
  }

  const hasFeedback = Boolean(interview.feedbackSubmittedAt);

  return (
    <>
      <Link
        href="/careers/operations/interviews"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to interviews
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT — Interview info */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">
              Interview information
            </h2>
            <InterviewStatusBadge status={interview.status} size="md" />
          </div>

          <FieldGroup label="Candidate">
            <div className="text-lg font-semibold text-gray-900">
              {interview.candidateName ?? '(unnamed)'}
            </div>
            {interview.candidateEmail && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                {interview.candidateEmail}
              </div>
            )}
          </FieldGroup>

          <FieldGroup label="Position">
            <div className="text-sm text-gray-700">
              {interview.jobPostingTitle ?? '—'}
            </div>
            {interview.applicationStatus && (
              <div className="mt-1.5 inline-flex items-center gap-2 text-xs text-gray-500">
                Application:&nbsp;
                <ApplicationStatusBadge status={interview.applicationStatus} />
              </div>
            )}
          </FieldGroup>

          <FieldGroup label="Scheduled">
            <div className="text-sm text-gray-700">
              {formatFull(interview.scheduledAt)}
            </div>
            <div className="text-xs text-gray-500">
              Duration: {interview.durationMinutes} min
            </div>
          </FieldGroup>

          <FieldGroup label="Type">
            <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {TYPE_LABEL[interview.type] ?? interview.type}
            </span>
          </FieldGroup>

          <FieldGroup label="Interviewer">
            <div className="flex items-center gap-1 text-sm text-gray-700">
              <UserIcon className="h-3.5 w-3.5" strokeWidth={2} />
              {interview.interviewerName ?? '—'}
            </div>
          </FieldGroup>

          <FieldGroup label="Meeting link">
            {interview.meetingUrl ? (
              <a
                href={interview.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
              >
                Join Meet
                <ExternalLink className="h-3 w-3" strokeWidth={2} />
              </a>
            ) : (
              <span className="text-xs text-gray-400">No meeting URL set</span>
            )}
          </FieldGroup>

          {interview.candidateNotes && (
            <FieldGroup label="Notes for candidate">
              <blockquote className="whitespace-pre-wrap rounded-md border-l-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {interview.candidateNotes}
              </blockquote>
            </FieldGroup>
          )}

          {isAdminErm && interview.status === 'SCHEDULED' && (
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => void updateStatus('NO_SHOW')}
                disabled={statusBusy !== null}
                className="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                {statusBusy === 'NO_SHOW' ? 'Marking…' : 'Mark No-Show'}
              </button>
              <button
                type="button"
                onClick={() => void updateStatus('CANCELLED')}
                disabled={statusBusy !== null}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {statusBusy === 'CANCELLED' ? 'Cancelling…' : 'Cancel'}
              </button>
            </div>
          )}
        </section>

        {/* RIGHT — Feedback */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Feedback</h2>

          {interview.status === 'CANCELLED' || interview.status === 'NO_SHOW' ? (
            <p className="text-sm text-gray-500">
              No feedback for {interview.status.toLowerCase().replace('_', '-')} interviews.
            </p>
          ) : hasFeedback && !editingFeedback ? (
            <FeedbackDisplay
              interview={interview}
              canEdit={canSubmitFeedback}
              onEdit={() => setEditingFeedback(true)}
            />
          ) : canSubmitFeedback ? (
            <FeedbackForm
              interviewId={interview.id}
              initial={
                hasFeedback
                  ? {
                      technicalRating: interview.feedbackTechnicalRating ?? undefined,
                      communicationRating:
                        interview.feedbackCommunicationRating ?? undefined,
                      problemSolvingRating:
                        interview.feedbackProblemSolvingRating ?? undefined,
                      // Phase 2.2 stores unified comments on a new column.
                      // Legacy rows back-fill from strengths so prior feedback
                      // survives an edit without manual re-entry.
                      comments:
                        interview.feedbackComments
                          ?? interview.feedbackStrengths
                          ?? undefined,
                      recommendation: interview.feedbackRecommendation ?? undefined,
                    }
                  : undefined
              }
              onSubmitted={(updated) => {
                setInterview(updated);
                setEditingFeedback(false);
              }}
              onCancel={editingFeedback ? () => setEditingFeedback(false) : undefined}
            />
          ) : (
            <p className="text-sm text-gray-500">
              Feedback can only be submitted by the assigned interviewer
              {' '}
              ({interview.interviewerName ?? '—'}).
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function FeedbackDisplay({
  interview,
  canEdit,
  onEdit,
}: {
  interview: InterviewResponse;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const rec = interview.feedbackRecommendation;
  return (
    <div className="space-y-5">
      <div className="text-xs text-gray-500">
        Submitted by{' '}
        <span className="font-medium text-gray-700">
          {interview.feedbackSubmittedByName ?? '—'}
        </span>{' '}
        on {formatFull(interview.feedbackSubmittedAt)}
      </div>

      <RatingRow label="Overall" value={interview.feedbackOverallRating} />
      {interview.feedbackTechnicalRating != null && (
        <RatingRow label="Technical" value={interview.feedbackTechnicalRating} />
      )}
      {interview.feedbackCommunicationRating != null && (
        <RatingRow label="Communication" value={interview.feedbackCommunicationRating} />
      )}
      {interview.feedbackProblemSolvingRating != null && (
        <RatingRow
          label="Problem solving"
          value={interview.feedbackProblemSolvingRating}
        />
      )}

      {interview.feedbackComments && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
            Comments
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {interview.feedbackComments}
          </p>
        </div>
      )}

      {/* Legacy /feedback rows wrote into the strengths/concerns pair — keep
          rendering them when present so historical scorecards remain visible. */}
      {!interview.feedbackComments && interview.feedbackStrengths && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
            Strengths
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {interview.feedbackStrengths}
          </p>
        </div>
      )}

      {!interview.feedbackComments && interview.feedbackConcerns && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
            Concerns
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {interview.feedbackConcerns}
          </p>
        </div>
      )}

      {rec && (
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
            Recommendation
          </div>
          <span
            className={
              'inline-block rounded-full px-3 py-1 text-sm font-semibold ' +
              RECOMMENDATION_COLOR[rec]
            }
          >
            {RECOMMENDATION_LABEL[rec]}
          </span>
        </div>
      )}

      {canEdit && (
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit feedback
          </button>
        </div>
      )}
    </div>
  );
}

function RatingRow({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="inline-block rounded-md bg-gray-100 px-2.5 py-1 text-sm font-semibold text-gray-800">
        {value ?? '—'} / 5
      </span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-6"
        >
          <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-24 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
