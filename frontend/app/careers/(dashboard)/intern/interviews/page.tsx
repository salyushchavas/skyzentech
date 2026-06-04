'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, User as UserIcon, Video } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import InterviewStatusBadge from '@/components/interviews/InterviewStatusBadge';
import { formatFull, isPast } from '@/lib/format-date';
import type { CandidateInterviewResponse } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  INITIAL_SCREEN: 'Initial Screen',
  TECHNICAL: 'Technical',
  BEHAVIORAL: 'Behavioral',
  CULTURE_FIT: 'Culture Fit',
  FINAL_ROUND: 'Final Round',
};

export default function CandidateInterviewsPage() {
  return (
    <ProtectedRoute requiredRoles={['APPLICANT', 'INTERN']}>
      <DashboardLayout title="My Interviews">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [interviews, setInterviews] = useState<CandidateInterviewResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<CandidateInterviewResponse[]>('/api/v1/interviews/me');
      setInterviews(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your interviews.");
      setInterviews(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    if (!interviews) return { upcoming: [], past: [] };
    const up: CandidateInterviewResponse[] = [];
    const pa: CandidateInterviewResponse[] = [];
    for (const i of interviews) {
      if (isPast(i.scheduledAt) || i.status !== 'SCHEDULED') {
        pa.push(i);
      } else {
        up.push(i);
      }
    }
    up.sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
    pa.sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
    return { upcoming: up, past: pa };
  }, [interviews]);

  if (interviews === null && !error) return <LoadingSkeleton />;

  return (
    <>
      <p className="mb-6 text-sm text-gray-600">
        Your scheduled and past interviews. We&apos;ll notify you here when a new one is
        set up.
      </p>

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {interviews !== null && interviews.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-700">
            No interviews scheduled yet.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            We&apos;ll notify you here as soon as one is set up.
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-8 space-y-4">
          {upcoming.map((i) => (
            <InterviewCard key={i.id} interview={i} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Past interviews</h3>
          <div className="space-y-4">
            {past.map((i) => (
              <InterviewCard key={i.id} interview={i} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function InterviewCard({ interview }: { interview: CandidateInterviewResponse }) {
  const showJoin =
    interview.status === 'SCHEDULED' && Boolean(interview.meetingUrl);
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <InterviewStatusBadge status={interview.status} />
        <div className="text-sm font-medium text-gray-900">
          {formatFull(interview.scheduledAt)}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-700">
        <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {TYPE_LABEL[interview.type] ?? interview.type}
        </span>
        <span className="text-xs text-gray-500">
          {interview.durationMinutes} minutes
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <UserIcon className="h-3.5 w-3.5" strokeWidth={2} />
          {interview.interviewerName ?? '—'}
        </span>
      </div>

      {showJoin && (
        <a
          href={interview.meetingUrl!}
          target="_blank"
          rel="noreferrer"
          className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          <Video className="h-4 w-4" strokeWidth={2} />
          Join Meet
          <ExternalLink className="h-3 w-3" strokeWidth={2} />
        </a>
      )}

      {interview.candidateNotes && (
        <div className="rounded-md border-l-2 border-gray-300 bg-gray-50 px-3 py-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            From your interviewer
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {interview.candidateNotes}
          </p>
        </div>
      )}
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-5"
        >
          <div className="flex justify-between">
            <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
