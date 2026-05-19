'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import RatingSelector from './RatingSelector';
import type {
  InterviewRecommendation,
  InterviewResponse,
  SubmitFeedbackRequest,
} from '@/types';

interface Props {
  interviewId: string;
  initial?: Partial<{
    overallRating: number;
    technicalRating: number;
    communicationRating: number;
    strengths: string;
    concerns: string;
    recommendation: InterviewRecommendation;
  }>;
  onSubmitted: (updated: InterviewResponse) => void;
  onCancel?: () => void;
}

const RECOMMENDATIONS: { value: InterviewRecommendation; label: string }[] = [
  { value: 'STRONG_HIRE', label: 'Strong Hire' },
  { value: 'HIRE', label: 'Hire' },
  { value: 'NO_HIRE', label: 'No Hire' },
  { value: 'STRONG_NO_HIRE', label: 'Strong No Hire' },
];

export default function FeedbackForm({
  interviewId,
  initial,
  onSubmitted,
  onCancel,
}: Props) {
  const [overall, setOverall] = useState<number | null>(initial?.overallRating ?? null);
  const [technical, setTechnical] = useState<number | null>(
    initial?.technicalRating ?? null
  );
  const [communication, setCommunication] = useState<number | null>(
    initial?.communicationRating ?? null
  );
  const [strengths, setStrengths] = useState(initial?.strengths ?? '');
  const [concerns, setConcerns] = useState(initial?.concerns ?? '');
  const [recommendation, setRecommendation] = useState<InterviewRecommendation | null>(
    initial?.recommendation ?? null
  );

  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    if (overall === null) {
      setFieldError('Overall rating is required.');
      return;
    }
    if (!recommendation) {
      setFieldError('Pick a recommendation.');
      return;
    }

    const body: SubmitFeedbackRequest = {
      overallRating: overall,
      technicalRating: technical ?? undefined,
      communicationRating: communication ?? undefined,
      strengths: strengths.trim() || undefined,
      concerns: concerns.trim() || undefined,
      recommendation,
    };

    setSubmitting(true);
    try {
      const res = await api.post<InterviewResponse>(
        `/api/v1/interviews/${interviewId}/feedback`,
        body
      );
      toast.success('Feedback submitted');
      onSubmitted(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not submit feedback';
      toast.error(msg);
      setFieldError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <RatingSelector
        value={overall}
        onChange={setOverall}
        label="Overall rating *"
      />

      <RatingSelector
        value={technical}
        onChange={setTechnical}
        label="Technical rating"
        allowSkip
      />

      <RatingSelector
        value={communication}
        onChange={setCommunication}
        label="Communication rating"
        allowSkip
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Strengths
        </label>
        <textarea
          value={strengths}
          onChange={(e) => setStrengths(e.target.value)}
          rows={4}
          placeholder="What the candidate did well…"
          className="w-full resize-y rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Concerns
        </label>
        <textarea
          value={concerns}
          onChange={(e) => setConcerns(e.target.value)}
          rows={4}
          placeholder="Areas that need follow-up or that gave you pause…"
          className="w-full resize-y rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Recommendation *
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RECOMMENDATIONS.map((opt) => {
            const active = recommendation === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRecommendation(opt.value)}
                className={
                  'rounded-md border px-3 py-2 text-sm font-medium transition-colors ' +
                  (active
                    ? 'border-primary-700 bg-primary-700 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
                }
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {fieldError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {fieldError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit feedback'}
        </button>
      </div>
    </form>
  );
}
