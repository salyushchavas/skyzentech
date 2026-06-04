'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Lock, Star } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  EvaluationRecommendation,
  EvaluationResponse,
  EvaluationStatus,
  EvaluationType,
  RubricCriterion,
} from '@/types';

/**
 * HR / Compliance read-only view of a candidate's evaluations.
 *
 * Backed by /api/v1/evaluations/intern/{candidateId} which authorizes
 * HR (along with the engagement's supervisor and SUPER_ADMIN).
 * I-983 checkpoints are the primary HR-relevant subset, but other types are
 * still surfaced here since HR may need full history for performance reviews.
 */
export default function HrCandidateEvaluationsPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout title="Candidate Evaluations">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

const TYPE_LABEL: Record<EvaluationType, string> = {
  MIDPOINT: 'Midpoint',
  FINAL: 'Final',
  I983_12MO: 'I-983 12-month',
  I983_FINAL: 'I-983 final',
  CHECKPOINT: 'Checkpoint',
};

const STATUS_PILL: Record<EvaluationStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  FINALIZED: 'bg-emerald-100 text-emerald-800',
};

const RECOMMENDATION_LABEL: Record<EvaluationRecommendation, string> = {
  HIGHLY_RECOMMENDED: 'Highly recommended',
  RECOMMENDED: 'Recommended',
  NEEDS_IMPROVEMENT: 'Needs improvement',
  NOT_RECOMMENDED: 'Not recommended',
};

const CRITERIA_LABEL: Record<RubricCriterion, string> = {
  TECHNICAL_SKILLS: 'Technical skills',
  CODE_QUALITY: 'Code quality',
  COMMUNICATION: 'Communication',
  INITIATIVE: 'Initiative',
  PROFESSIONALISM: 'Professionalism',
  LEARNING: 'Learning',
};

function Body() {
  const params = useParams();
  const candidateId =
    typeof params?.candidateId === 'string'
      ? params.candidateId
      : Array.isArray(params?.candidateId)
        ? params.candidateId[0]
        : null;

  const [evaluations, setEvaluations] = useState<EvaluationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!candidateId) return;
    setError(null);
    try {
      const res = await api.get<EvaluationResponse[]>(
        `/api/v1/evaluations/intern/${candidateId}`
      );
      setEvaluations(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load evaluations.");
      setEvaluations(null);
    }
  }, [candidateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = openId ? evaluations?.find((e) => e.id === openId) ?? null : null;
  const candidateName = evaluations?.[0]?.internName;
  const i983 = (evaluations ?? []).filter(
    (e) => e.type === 'I983_12MO' || e.type === 'I983_FINAL'
  );

  return (
    <section className="space-y-6">
      <div>
        <Link
          href="/careers/erm/i9-everify"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Back to compliance
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-gray-900">
          Evaluations{candidateName ? ` — ${candidateName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Read-only view for compliance review. I-983 checkpoints are highlighted.
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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

      {open && <DetailModal evaluation={open} onClose={() => setOpenId(null)} />}

      {evaluations === null ? (
        <Skeleton />
      ) : evaluations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No evaluations yet for this candidate.
        </div>
      ) : (
        <>
          {i983.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                I-983 checkpoints
              </div>
              <ul className="space-y-2">
                {i983.map((e) => (
                  <li
                    key={e.id}
                    onClick={() => setOpenId(e.id)}
                    className="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 p-4 transition-shadow hover:shadow-sm"
                  >
                    <Row e={e} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              All evaluations
            </div>
            <ul className="space-y-2">
              {evaluations.map((e) => (
                <li
                  key={e.id}
                  onClick={() => setOpenId(e.id)}
                  className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
                >
                  <Row e={e} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

function Row({ e }: { e: EvaluationResponse }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {TYPE_LABEL[e.type]}
          </h3>
          <span
            className={
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
              STATUS_PILL[e.status]
            }
          >
            {e.status === 'DRAFT' ? 'Draft' : 'Finalized'}
          </span>
          {e.status === 'FINALIZED' && (
            <Lock className="h-3 w-3 text-emerald-700" strokeWidth={2} />
          )}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {e.periodStart && e.periodEnd && (
            <span>
              {formatDateOnly(e.periodStart)} – {formatDateOnly(e.periodEnd)} ·{' '}
            </span>
          )}
          By {e.evaluatorName ?? 'supervisor'}
          {e.finalizedAt && <> · {formatRelative(e.finalizedAt)}</>}
        </div>
      </div>
      {typeof e.overallRating === 'number' && (
        <RatingStars value={e.overallRating} />
      )}
    </div>
  );
}

function DetailModal({
  evaluation,
  onClose,
}: {
  evaluation: EvaluationResponse;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {TYPE_LABEL[evaluation.type]} evaluation
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              By {evaluation.evaluatorName ?? 'supervisor'}
              {evaluation.periodStart && evaluation.periodEnd && (
                <>
                  {' · '}
                  {formatDateOnly(evaluation.periodStart)} –{' '}
                  {formatDateOnly(evaluation.periodEnd)}
                </>
              )}
            </p>
          </div>
          <span
            className={
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
              STATUS_PILL[evaluation.status]
            }
          >
            {evaluation.status === 'DRAFT' ? 'Draft' : 'Finalized'}
          </span>
        </div>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
          {typeof evaluation.overallRating === 'number' && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Overall
              </div>
              <div className="flex items-center gap-3">
                <RatingStars value={evaluation.overallRating} large />
                {evaluation.recommendation && (
                  <span className="rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-800 ring-1 ring-gray-200">
                    {RECOMMENDATION_LABEL[evaluation.recommendation]}
                  </span>
                )}
              </div>
            </div>
          )}

          {evaluation.rubric.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Rubric
              </div>
              <ul className="space-y-1.5">
                {evaluation.rubric.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {CRITERIA_LABEL[r.criterion]}
                      </div>
                      {r.note && (
                        <p className="mt-0.5 text-xs text-gray-600">{r.note}</p>
                      )}
                    </div>
                    <RatingStars value={r.score} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.strengths && (
            <FieldBlock label="Strengths" value={evaluation.strengths} />
          )}
          {evaluation.areasForImprovement && (
            <FieldBlock
              label="Areas for improvement"
              value={evaluation.areasForImprovement}
            />
          )}
          {evaluation.comments && (
            <FieldBlock label="Comments" value={evaluation.comments} />
          )}

          {evaluation.selfReview && (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                Intern self-review
              </div>
              {evaluation.selfReview.reflection && (
                <p className="whitespace-pre-wrap text-sm text-sky-900">
                  {evaluation.selfReview.reflection}
                </p>
              )}
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-sky-800">
                {typeof evaluation.selfReview.selfOverallRating === 'number' && (
                  <div className="rounded bg-white px-2 py-1 ring-1 ring-sky-200">
                    <div className="text-[10px] uppercase tracking-wide text-sky-700">
                      Overall
                    </div>
                    <div className="text-sm font-semibold text-sky-900">
                      {evaluation.selfReview.selfOverallRating}/5
                    </div>
                  </div>
                )}
                {typeof evaluation.selfReview.selfTechnicalRating === 'number' && (
                  <div className="rounded bg-white px-2 py-1 ring-1 ring-sky-200">
                    <div className="text-[10px] uppercase tracking-wide text-sky-700">
                      Technical
                    </div>
                    <div className="text-sm font-semibold text-sky-900">
                      {evaluation.selfReview.selfTechnicalRating}/5
                    </div>
                  </div>
                )}
                {typeof evaluation.selfReview.selfGrowthRating === 'number' && (
                  <div className="rounded bg-white px-2 py-1 ring-1 ring-sky-200">
                    <div className="text-[10px] uppercase tracking-wide text-sky-700">
                      Growth
                    </div>
                    <div className="text-sm font-semibold text-sky-900">
                      {evaluation.selfReview.selfGrowthRating}/5
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-800">{value}</p>
    </div>
  );
}

function RatingStars({ value, large }: { value: number; large?: boolean }) {
  const size = large ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            size +
            ' ' +
            (i <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300')
          }
          strokeWidth={2}
        />
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      <div className="h-20 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="h-20 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
    </div>
  );
}
