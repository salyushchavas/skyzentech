'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { HireApprovalDetail } from '@/components/manager/hire-approval-types';

export default function HireApprovalDetailPage() {
  const params = useParams<{ interviewId: string }>();
  const router = useRouter();
  const interviewId = params?.interviewId;
  const [d, setD] = useState<HireApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!interviewId) return;
    setLoading(true);
    try {
      const res = await api.get<HireApprovalDetail>(
        `/api/v1/manager/hire-approvals/${interviewId}`,
      );
      setD(res.data);
      setErr(null);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => { void load(); }, [load]);

  async function decide(action: 'approve' | 'reject') {
    if (!interviewId) return;
    if (action === 'reject') {
      const ok = confirm('Reject this hire? The candidate will be marked REJECTED and the ERM will be notified.');
      if (!ok) return;
    }
    setSubmitting(true);
    setActionErr(null);
    try {
      await api.post(
        `/api/v1/manager/hire-approvals/${interviewId}/${action}`,
        note.trim() ? { note: note.trim() } : {},
      );
      router.push('/careers/manager/hire-approvals');
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setActionErr(ax.response?.data?.error ?? ax.message ?? 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !d) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (!d) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {err ?? 'Not found.'}
        </p>
      </div>
    );
  }

  const decided = d.managerHireDecision === 'APPROVED' || d.managerHireDecision === 'REJECTED';

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <p className="text-xs">
        <Link href="/careers/manager/hire-approvals" className="text-teal-700 hover:underline">
          ← Back to Hire Approvals
        </Link>
      </p>

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          {d.candidateName ?? '—'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {d.jobTitle ?? '(no job title)'}
          {d.technology && <span className="ml-2 text-slate-500">· {d.technology}</span>}
        </p>
        {d.candidateEmail && (
          <p className="mt-1 text-xs text-slate-500">{d.candidateEmail}</p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <main className="space-y-4 lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Scorecard</h2>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <Score label="Technical" value={d.technicalScore} />
              <Score label="Communication" value={d.communicationScore} />
              <Score label="Cultural fit" value={d.culturalFitScore} />
            </div>
            <div className="mt-4 text-xs">
              <p className="font-semibold text-slate-700">ERM recommendation</p>
              <p className="mt-1 text-sm text-slate-900">
                {d.overallRecommendation
                  ? d.overallRecommendation.replace(/_/g, ' ')
                  : 'No recommendation'}
              </p>
            </div>
            {d.scorecardSubmittedAt && (
              <p className="mt-3 text-[11px] text-slate-500">
                Submitted{' '}
                {new Date(d.scorecardSubmittedAt).toLocaleString()}
                {d.scorecardSubmittedByName ? ` by ${d.scorecardSubmittedByName}` : ''}
              </p>
            )}
          </section>

          {d.applicantVisibleNotes && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Applicant-visible notes
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {d.applicantVisibleNotes}
              </p>
            </section>
          )}

          {d.internalNotes && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-amber-900">
                Internal notes (ERM)
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm text-amber-900">
                {d.internalNotes}
              </p>
            </section>
          )}

          <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
            <h2 className="text-sm font-semibold text-slate-700">
              Zoom recording
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              The interview recording will appear here once the Zoom-recording
              integration lands. For now, decide from the scorecard above.
            </p>
          </section>
        </main>

        <aside className="space-y-3">
          {decided ? (
            <section className={
              d.managerHireDecision === 'APPROVED'
                ? 'rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm'
                : 'rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm'
            }>
              <h3 className="text-xs font-semibold uppercase tracking-wide">
                Decision: {d.managerHireDecision}
              </h3>
              {d.managerHireDecisionAt && (
                <p className="mt-1 text-[11px] text-slate-700">
                  {new Date(d.managerHireDecisionAt).toLocaleString()}
                </p>
              )}
              {d.managerHireDecisionNote && (
                <p className="mt-2 whitespace-pre-line text-xs text-slate-800">
                  {d.managerHireDecisionNote}
                </p>
              )}
            </section>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hire decision
              </h3>
              <label className="mt-3 block text-xs font-medium text-slate-700">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-y rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              />
              {actionErr && (
                <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                  {actionErr}
                </p>
              )}
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => decide('approve')}
                  disabled={submitting}
                  className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-slate-300"
                >
                  {submitting ? 'Saving…' : 'Hire'}
                </button>
                <button
                  type="button"
                  onClick={() => decide('reject')}
                  disabled={submitting}
                  className="w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  No-Hire
                </button>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Approving sets the candidate to SELECTED and unblocks the
                ERM&rsquo;s Send Offer action. Rejecting marks the
                application REJECTED.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {value == null ? '—' : value}
      </p>
      <p className="text-[10px] text-slate-500">of 10</p>
    </div>
  );
}
