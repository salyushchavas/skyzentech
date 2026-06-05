'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { InterviewDetail, ReasonGroup, ReasonOption } from './types';

interface Props {
  interview: InterviewDetail;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export default function RescheduleModal({ interview, open, onClose, onApplied }: Props) {
  const [groups, setGroups] = useState<ReasonGroup[]>([]);
  const [scheduledFor, setScheduledFor] = useState('');
  const [duration, setDuration] = useState<number>(
    interview.durationMinutes ?? 60,
  );
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [notifyApplicant, setNotifyApplicant] = useState(true);
  const [notifyInterviewer, setNotifyInterviewer] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReasonCode('');
    setReasonText('');
    setScheduledFor('');
    setErr(null);
    void (async () => {
      try {
        const res = await api.get<ReasonGroup[]>(
          '/api/v1/erm/interviews/reason-codes?family=RESCHEDULE',
        );
        setGroups(res.data ?? []);
      } catch {
        setGroups([]);
      }
    })();
  }, [open]);

  if (!open) return null;
  const selected: ReasonOption | null =
    groups.flatMap((g) => g.options).find((o) => o.code === reasonCode) ?? null;

  async function submit() {
    setErr(null);
    if (!scheduledFor) {
      setErr('Pick a new date/time.');
      return;
    }
    if (!reasonCode) {
      setErr('Select a reason.');
      return;
    }
    if (selected?.requiresFreeText && reasonText.trim().length < 10) {
      setErr('Free-text reason required (min 10 chars).');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/v1/erm/interviews/${interview.id}/reschedule`, {
        scheduledFor: new Date(scheduledFor).toISOString(),
        durationMinutes: duration,
        reasonCode,
        reasonText: reasonText.trim() || null,
        notifyApplicant,
        notifyInterviewer,
      });
      onApplied();
      onClose();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(
        ax.response?.data?.error ??
          (e instanceof Error ? e.message : 'Reschedule failed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Reschedule interview</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-800">New date / time</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-800">Duration (min)</label>
            <input
              type="number"
              min={15}
              max={180}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 w-32 rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-800">
              Reason <span className="text-rose-600">*</span>
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Select a reason…</option>
              {groups.map((g) => (
                <optgroup key={g.category} label={g.category.replace(/_/g, ' ')}>
                  {g.options.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {selected?.requiresFreeText && (
            <div>
              <label className="text-sm font-medium text-slate-800">
                Free-text reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyApplicant}
                onChange={(e) => setNotifyApplicant(e.target.checked)}
              />
              Notify applicant
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyInterviewer}
                onChange={(e) => setNotifyInterviewer(e.target.checked)}
              />
              Notify interviewer
            </label>
          </div>
          {err && (
            <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {err}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
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
            {submitting ? 'Saving…' : 'Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
