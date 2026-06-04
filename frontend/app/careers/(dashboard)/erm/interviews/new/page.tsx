'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { combineDateAndTime } from '@/lib/format-date';
import type {
  ApplicationResponse,
  ApplicationStatus,
  InterviewResponse,
  InterviewType,
  Page,
  ScheduleInterviewRequest,
} from '@/types';

const SCHEDULABLE: ReadonlyArray<ApplicationStatus> = [
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
];

const TYPE_OPTIONS: { value: InterviewType; label: string }[] = [
  { value: 'INITIAL_SCREEN', label: 'Initial Screen' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'BEHAVIORAL', label: 'Behavioral' },
  { value: 'CULTURE_FIT', label: 'Culture Fit' },
  { value: 'FINAL_ROUND', label: 'Final Round' },
];

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

export default function NewInterviewPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS']}>
      <DashboardLayout title="Schedule Interview">
        <Form />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Form() {
  const router = useRouter();
  const { user } = useAuth();

  const [apps, setApps] = useState<ApplicationResponse[] | null>(null);
  const [appsError, setAppsError] = useState<string | null>(null);

  const [applicationId, setApplicationId] = useState('');
  const [type, setType] = useState<InterviewType>('TECHNICAL');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [duration, setDuration] = useState(60);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [candidateNotes, setCandidateNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    setAppsError(null);
    try {
      const res = await api.get<Page<ApplicationResponse>>('/api/v1/applications', {
        params: { size: 100 },
      });
      const eligible = (res.data?.content ?? []).filter((a) =>
        SCHEDULABLE.includes(a.status)
      );
      setApps(eligible);
    } catch (err: any) {
      setAppsError(err?.response?.data?.error ?? 'Could not load applications');
      setApps(null);
    }
  }, []);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const sortedApps = useMemo(() => {
    if (!apps) return [];
    return [...apps].sort((a, b) =>
      (a.candidateName ?? '').localeCompare(b.candidateName ?? '')
    );
  }, [apps]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!applicationId) {
      setFormError('Pick an application.');
      return;
    }
    if (!user?.userId) {
      setFormError('You must be signed in to schedule an interview.');
      return;
    }
    if (!dateStr || !timeStr) {
      setFormError('Pick a date and time.');
      return;
    }

    const scheduledAt = combineDateAndTime(dateStr, timeStr);
    if (!scheduledAt) {
      setFormError('Invalid date or time.');
      return;
    }
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      setFormError('Scheduled time must be in the future.');
      return;
    }

    const body: ScheduleInterviewRequest = {
      applicationId,
      interviewerId: user.userId,
      scheduledAt,
      durationMinutes: duration,
      type,
      meetingUrl: meetingUrl.trim() || undefined,
      candidateNotes: candidateNotes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await api.post<InterviewResponse>('/api/v1/interviews', body);
      toast.success('Interview scheduled');
      router.push('/careers/operations/interviews');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not schedule interview';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Application */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Application <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-gray-500">
              Pick a candidate who&apos;s in Shortlisted, Interview Scheduled, or
              Interviewed status.
            </p>
            {appsError && (
              <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {appsError}{' '}
                <button
                  type="button"
                  onClick={() => void loadApps()}
                  className="ml-1 font-medium underline"
                >
                  Retry
                </button>
              </div>
            )}
            <select
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              disabled={apps === null}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700 disabled:bg-gray-50"
            >
              <option value="">
                {apps === null
                  ? 'Loading applications…'
                  : sortedApps.length === 0
                    ? 'No eligible applications'
                    : 'Select an application…'}
              </option>
              {sortedApps.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.candidateName ?? '(unnamed)') +
                    ' — ' +
                    (a.jobPostingTitle ?? '(no posting)') +
                    ' (' +
                    a.status +
                    ')'}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Interview type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InterviewType)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date + time */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Scheduled date &amp; time <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
              />
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700 sm:w-44"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700 sm:w-44"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </select>
          </div>

          {/* Interviewer (read-only — current user) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Interviewer
            </label>
            <p className="mb-2 text-xs text-gray-500">
              Multi-interviewer support coming soon. The current logged-in user will be
              the interviewer.
            </p>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {user
                ? `${user.fullName} (${user.email})`
                : '—'}
            </div>
          </div>

          {/* Meeting URL */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Meeting URL
            </label>
            <p className="mb-2 text-xs text-gray-500">
              Paste a Google Meet, Zoom, or Teams link.
            </p>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes for candidate
            </label>
            <p className="mb-2 text-xs text-gray-500">
              What the candidate will see in their interview details. Topics to review,
              materials to bring, etc.
            </p>
            <textarea
              value={candidateNotes}
              onChange={(e) => setCandidateNotes(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
            />
          </div>

          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
            >
              {submitting ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
