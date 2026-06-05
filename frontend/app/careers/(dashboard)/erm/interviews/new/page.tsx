'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import type { InterviewerView } from '@/components/erm/interviews/types';

export default function CreateInterviewPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const applicationId = sp?.get('applicationId') ?? '';

  const [interviewers, setInterviewers] = useState<InterviewerView[]>([]);
  const [interviewerId, setInterviewerId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [prepInstructions, setPrepInstructions] = useState('');
  const [manualZoomLink, setManualZoomLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadInterviewers = useCallback(async () => {
    try {
      const res = await api.get<InterviewerView[]>(
        '/api/v1/erm/interviews/eligible-interviewers',
      );
      setInterviewers(res.data ?? []);
    } catch {
      setInterviewers([]);
    }
  }, []);

  useEffect(() => { void loadInterviewers(); }, [loadInterviewers]);

  async function submit() {
    setErr(null);
    if (!applicationId) { setErr('applicationId is required (open from an Application).'); return; }
    if (!interviewerId) { setErr('Pick an interviewer.'); return; }
    if (!scheduledFor) { setErr('Pick a date/time.'); return; }
    setSubmitting(true);
    try {
      const res = await api.post<{ id: string }>(
        '/api/v1/erm/interviews',
        {
          applicationId,
          scheduledFor: new Date(scheduledFor).toISOString(),
          durationMinutes: duration,
          timezone,
          interviewerId,
          prepInstructions: prepInstructions.trim() || null,
          manualZoomLink: manualZoomLink.trim() || null,
        },
      );
      router.push(`/careers/erm/interviews/${res.data.id}`);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(
        ax.response?.data?.error ??
          (e instanceof Error ? e.message : 'Failed to create interview'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="Schedule Interview"
          subtitle={applicationId ? `Application: ${applicationId}` : 'No application context'}
        />

        <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {!applicationId && (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Open this page from a Shortlisted application's detail to attach the
              applicationId. Without it, the create call will fail.
            </p>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-800">Interviewer</label>
              <select
                value={interviewerId}
                onChange={(e) => setInterviewerId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Pick an interviewer…</option>
                {interviewers.map((i) => (
                  <option key={i.userId} value={i.userId}>
                    {i.fullName} · {i.role}
                    {i.hasZoomEmail ? '' : ' (no Zoom email)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-800">Date / time</label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-800">Duration (min)</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {[30, 45, 60].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">Timezone</label>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">
                Prep instructions
              </label>
              <textarea
                value={prepInstructions}
                onChange={(e) => setPrepInstructions(e.target.value)}
                rows={4}
                className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">
                Manual Zoom link <span className="text-xs text-slate-500">(optional override)</span>
              </label>
              <input
                value={manualZoomLink}
                onChange={(e) => setManualZoomLink(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            {err && (
              <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {err}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {submitting ? 'Scheduling…' : 'Schedule interview'}
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
