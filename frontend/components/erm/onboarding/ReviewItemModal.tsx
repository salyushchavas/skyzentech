'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type {
  ItemDetail,
  ReasonCodeGroup,
  ReasonCodeOption,
  ReviewDecision,
} from './types';

type Props = {
  item: ItemDetail;
  onClose: () => void;
  onDone: (updated: ItemDetail) => void;
};

export default function ReviewItemModal({ item, onClose, onDone }: Props) {
  const [decision, setDecision] = useState<ReviewDecision>('ACCEPT');
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [ermComments, setErmComments] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [reasons, setReasons] = useState<ReasonCodeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ReasonCodeGroup[]>('/api/v1/erm/onboarding/reason-codes')
      .then((res) => {
        const flat = res.data.flatMap((g) => g.options);
        setReasons(flat);
      })
      .catch(() => setReasons([]));
  }, []);

  const requiresComments = decision !== 'ACCEPT';
  const selectedReason = reasons.find((r) => r.code === reasonCode);
  const needsFreeText = !!selectedReason?.requiresFreeText;
  const commentsValid = !requiresComments || ermComments.trim().length >= 20;
  const reasonValid = !requiresComments || reasonCode.length > 0;
  const freeTextValid = !needsFreeText || reasonText.trim().length >= 10;
  const canSubmit = commentsValid && reasonValid && freeTextValid && !submitting;

  async function submit() {
    setSubmitting(true);
    setErr(null);
    try {
      const body = {
        decision,
        reasonCode: requiresComments ? reasonCode : undefined,
        reasonText: reasonText.trim() || undefined,
        ermComments: requiresComments ? ermComments.trim() : undefined,
        internalNotes: internalNotes.trim() || undefined,
      };
      const res = await api.post<ItemDetail>(
        `/api/v1/erm/onboarding/items/${item.itemId}/review`,
        body,
      );
      onDone(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Review failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Review onboarding item
          </h3>
          <p className="text-xs text-slate-500">
            {item.category} — {item.applicantName ?? 'unknown applicant'}
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex gap-2">
            {(['ACCEPT', 'REJECT', 'RESEND'] as ReviewDecision[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDecision(d)}
                className={
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium ' +
                  (decision === d
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50')
                }
              >
                {d === 'ACCEPT' ? 'Accept' : d === 'REJECT' ? 'Reject' : 'Resend'}
              </button>
            ))}
          </div>
          {requiresComments && (
            <>
              <label className="block text-xs font-medium text-slate-700">
                Reason code <span className="text-rose-500">*</span>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="">Select a reason…</option>
                  {reasons.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              {needsFreeText && (
                <label className="block text-xs font-medium text-slate-700">
                  Reason detail <span className="text-rose-500">*</span>
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="At least 10 characters"
                  />
                </label>
              )}
              <label className="block text-xs font-medium text-slate-700">
                Applicant-visible comments <span className="text-rose-500">*</span>
                <textarea
                  value={ermComments}
                  onChange={(e) => setErmComments(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder="At least 20 characters — the applicant sees this verbatim"
                />
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {ermComments.trim().length}/20 min
                </span>
              </label>
            </>
          )}
          <label className="block text-xs font-medium text-slate-700">
            Internal notes
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="ERM-only — never returned to the intern"
            />
          </label>
          {err && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {err}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  );
}
