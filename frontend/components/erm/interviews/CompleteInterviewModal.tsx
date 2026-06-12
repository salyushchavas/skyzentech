'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import type {
  Decision,
  InterviewDetail,
  ReasonGroup,
  ReasonOption,
} from './types';

const DECISION_TO_PREFIX: Record<Decision, string> = {
  SELECTED: 'INTERVIEW_SELECT_',
  HOLD: 'INTERVIEW_HOLD_',
  REJECTED: 'INTERVIEW_REJECT_',
};

interface Props {
  interview: InterviewDetail;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export default function CompleteInterviewModal({
  interview,
  open,
  onClose,
  onApplied,
}: Props) {
  const [groups, setGroups] = useState<ReasonGroup[]>([]);
  const [decision, setDecision] = useState<Decision>('SELECTED');
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [technicalScore, setTechnicalScore] = useState<number | ''>('');
  const [communicationScore, setCommunicationScore] = useState<number | ''>('');
  const [culturalFitScore, setCulturalFitScore] = useState<number | ''>('');
  const [recommendation, setRecommendation] = useState('');
  const [applicantVisibleNotes, setApplicantVisibleNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDecision('SELECTED');
    setReasonCode('');
    setReasonText('');
    setTechnicalScore('');
    setCommunicationScore('');
    setCulturalFitScore('');
    setRecommendation('');
    setApplicantVisibleNotes('');
    setInternalNotes('');
    setErr(null);
    void (async () => {
      try {
        const res = await api.get<ReasonGroup[]>(
          '/api/v1/erm/interviews/reason-codes?family=DECISION',
        );
        setGroups(res.data ?? []);
      } catch {
        setGroups([]);
      }
    })();
  }, [open]);

  const filteredGroups = useMemo(() => {
    const prefix = DECISION_TO_PREFIX[decision];
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => o.code.startsWith(prefix)),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, decision]);

  const selectedOpt: ReasonOption | null = useMemo(() => {
    for (const g of filteredGroups) {
      const o = g.options.find((x) => x.code === reasonCode);
      if (o) return o;
    }
    return null;
  }, [filteredGroups, reasonCode]);

  // Phase 8.5 — surface missing-required-field state on the submit button
  // itself so the user never has to hunt for what's blocking the form.
  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!reasonCode) missing.push('Decision reason');
    if (selectedOpt?.requiresFreeText && reasonText.trim().length < 10) {
      missing.push('Free-text reason (≥ 10 chars)');
    }
    if (applicantVisibleNotes.trim().length < 20) {
      missing.push('Applicant-visible notes (≥ 20 chars)');
    }
    return missing;
  }, [reasonCode, selectedOpt, reasonText, applicantVisibleNotes]);
  const canSubmit = missingFields.length === 0 && !submitting;

  if (!open) return null;

  async function submit() {
    setErr(null);
    if (!reasonCode) {
      setErr('Select a decision reason.');
      return;
    }
    if (selectedOpt?.requiresFreeText && reasonText.trim().length < 10) {
      setErr('Free-text reason required (min 10 chars).');
      return;
    }
    if (applicantVisibleNotes.trim().length < 20) {
      setErr('Applicant-visible notes must be at least 20 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/v1/erm/interviews/${interview.id}/complete`, {
        decision,
        decisionReasonCode: reasonCode,
        decisionReasonText: reasonText.trim() || null,
        technicalScore: technicalScore === '' ? null : technicalScore,
        communicationScore: communicationScore === '' ? null : communicationScore,
        culturalFitScore: culturalFitScore === '' ? null : culturalFitScore,
        overallRecommendation: recommendation || null,
        applicantVisibleNotes: applicantVisibleNotes.trim(),
        internalNotes: internalNotes.trim() || null,
      });
      onApplied();
      onClose();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(
        ax.response?.data?.error ??
          (e instanceof Error ? e.message : 'Decision failed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
        <div className="overflow-y-auto p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Complete interview · Decision center
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Decision</p>
              <div className="mt-2 flex gap-2">
                {(['SELECTED', 'HOLD', 'REJECTED'] as Decision[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDecision(d);
                      setReasonCode('');
                    }}
                    className={
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ' +
                      (decision === d
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50')
                    }
                  >
                    {d === 'SELECTED'
                      ? 'Selected for offer'
                      : d === 'HOLD'
                        ? 'Hold'
                        : 'Rejected'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">
                Decision reason <span className="text-rose-600">*</span>
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select a reason…</option>
                {filteredGroups.map((g) => (
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

            {selectedOpt?.requiresFreeText && (
              <div>
                <label className="text-sm font-medium text-slate-800">
                  Free-text reason (ERM-only) <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <ScoreInput label="Technical" value={technicalScore} onChange={setTechnicalScore} />
              <ScoreInput label="Communication" value={communicationScore} onChange={setCommunicationScore} />
              <ScoreInput label="Cultural fit" value={culturalFitScore} onChange={setCulturalFitScore} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">
                Overall recommendation
              </label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">No recommendation</option>
                <option value="STRONG_HIRE">Strong Hire</option>
                <option value="HIRE">Hire</option>
                <option value="NO_HIRE">No Hire</option>
                <option value="STRONG_NO_HIRE">Strong No-Hire</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">
                Applicant-visible notes <span className="text-rose-600">*</span>{' '}
                <span className="text-xs text-slate-500">(min 20 chars)</span>
              </label>
              <textarea
                value={applicantVisibleNotes}
                onChange={(e) => setApplicantVisibleNotes(e.target.value)}
                rows={4}
                className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="mt-1 text-right text-[11px] text-slate-500">
                {applicantVisibleNotes.trim().length} characters
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">
                Internal notes <span className="text-xs text-slate-500">(ERM-only)</span>
              </label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={3}
                maxLength={5000}
                className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            {err && (
              <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {err}
              </p>
            )}
          </div>
        </div>

        <aside className="hidden overflow-y-auto border-l border-slate-200 bg-slate-50 p-6 lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Email preview to applicant
          </p>
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {decision === 'SELECTED'
                ? 'Great news from your Skyzen interview'
                : decision === 'HOLD'
                  ? 'Skyzen interview — under consideration'
                  : 'Skyzen interview decision'}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
              {applicantVisibleNotes.trim() || '(applicant-visible notes appear here)'}
            </p>
            <p className="mt-4 text-[11px] text-slate-400">
              Template: INTERVIEW_{decision}
            </p>
          </div>
        </aside>
        </div>

        {/* Phase 8.5 — sticky footer keeps Submit visible regardless of
            how long the form scrolls. Disabled state surfaces what's
            missing via the title tooltip. */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-3">
          <p className="text-[11px] text-slate-500">
            {missingFields.length > 0
              ? `Required: ${missingFields.join(' · ')}`
              : 'Ready to submit.'}
          </p>
          <div className="flex gap-2">
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
              disabled={!canSubmit}
              title={
                missingFields.length > 0
                  ? `Fill required fields: ${missingFields.join(', ')}`
                  : undefined
              }
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Submit Decision'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | '';
  onChange: (v: number | '') => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700">{label} (1-10)</label>
      <input
        type="number"
        min={1}
        max={10}
        value={value}
        onChange={(e) =>
          onChange(e.target.value === '' ? '' : Number(e.target.value))
        }
        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
