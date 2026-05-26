'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Lock,
  Send,
  Star,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  EvaluationRecommendation,
  EvaluationResponse,
  EvaluationType,
  RubricCriterion,
  SubmitSelfReviewRequest,
} from '@/types';

/**
 * Intern evaluations view.
 *
 * Surfaces:
 *   - FINALIZED evaluations from /api/v1/evaluations/me  (read-only)
 *   - DRAFT I-983 evaluations from /api/v1/evaluations/me/self-reviewable
 *     so the intern can submit a reflection before the supervisor finalizes.
 *
 * Server-side gate: INTERN role; the active-engagement gate is implicit via
 * the Candidate-row requirement in the service.
 */
export default function CandidateEvaluationsPage() {
  return (
    <ProtectedRoute requiredRoles={['INTERN']}>
      <DashboardLayout title="Evaluations">
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
  const [finalized, setFinalized] = useState<EvaluationResponse[] | null>(null);
  const [drafts, setDrafts] = useState<EvaluationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsActive, setNeedsActive] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setNeedsActive(false);
    try {
      const [meRes, drRes] = await Promise.all([
        api.get<EvaluationResponse[]>('/api/v1/evaluations/me'),
        api.get<EvaluationResponse[]>('/api/v1/evaluations/me/self-reviewable'),
      ]);
      setFinalized(meRes.data ?? []);
      setDrafts(drRes.data ?? []);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setNeedsActive(true);
        setFinalized(null);
        setDrafts(null);
        return;
      }
      setError(err?.response?.data?.error ?? "Couldn't load your evaluations.");
      setFinalized(null);
      setDrafts(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const openEval = openId
    ? [...(drafts ?? []), ...(finalized ?? [])].find((e) => e.id === openId) ?? null
    : null;

  if (needsActive) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-sm text-blue-900">
        <p className="font-medium">Evaluations open up once your engagement is active.</p>
        <p className="mt-1 text-blue-800">
          Your supervisor will share evaluations here after milestones and at I-983 checkpoints.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">My evaluations</h1>
        <p className="mt-1 text-sm text-gray-600">
          Finalized evaluations from your supervisor. I-983 checkpoints may ask
          for your reflection before they&apos;re finalized.
        </p>
      </header>

      {toast && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {openEval && (
        <EvaluationDetailModal
          evaluation={openEval}
          onClose={() => setOpenId(null)}
          onSelfSaved={(msg) => {
            setOpenId(null);
            setToast(msg);
            void load();
          }}
        />
      )}

      {/* Drafts requiring self-review */}
      {drafts && drafts.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Action requested — add your reflection
          </div>
          <ul className="space-y-2">
            {drafts.map((e) => (
              <li
                key={e.id}
                className="cursor-pointer rounded-lg border border-amber-300 bg-amber-50 p-4 transition-shadow hover:shadow-sm"
                onClick={() => setOpenId(e.id)}
              >
                <Row e={e} draft />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Finalized list */}
      <div className="space-y-2">
        {drafts && drafts.length > 0 && (
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Finalized
          </div>
        )}
        {finalized === null ? (
          <Skeleton />
        ) : finalized.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
            No evaluations yet. Your supervisor will share these as you reach milestones.
          </div>
        ) : (
          <ul className="space-y-2">
            {finalized.map((e) => (
              <li
                key={e.id}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
                onClick={() => setOpenId(e.id)}
              >
                <Row e={e} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Row({ e, draft }: { e: EvaluationResponse; draft?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {TYPE_LABEL[e.type]}
          </h3>
          {draft ? (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              Self-review needed
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              Finalized
            </span>
          )}
          {!draft && <Lock className="h-3 w-3 text-emerald-700" strokeWidth={2} />}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {e.periodStart && e.periodEnd && (
            <span>
              {formatDateOnly(e.periodStart)} – {formatDateOnly(e.periodEnd)} ·{' '}
            </span>
          )}
          From {e.evaluatorName ?? 'your supervisor'}
          {e.finalizedAt && <> · {formatRelative(e.finalizedAt)}</>}
        </div>
      </div>
      {!draft && typeof e.overallRating === 'number' && (
        <RatingStars value={e.overallRating} />
      )}
    </div>
  );
}

// ── Detail modal ────────────────────────────────────────────────────────────

function EvaluationDetailModal({
  evaluation,
  onClose,
  onSelfSaved,
}: {
  evaluation: EvaluationResponse;
  onClose: () => void;
  onSelfSaved: (msg: string) => void;
}) {
  const isDraft = evaluation.status === 'DRAFT';
  const isI983 =
    evaluation.type === 'I983_12MO' || evaluation.type === 'I983_FINAL';
  const showSelfForm = isDraft && isI983;
  const existing = evaluation.selfReview ?? null;

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
              From {evaluation.evaluatorName ?? 'your supervisor'}
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
              (isDraft
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800')
            }
          >
            {isDraft ? 'Draft — awaiting finalize' : 'Finalized'}
          </span>
        </div>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
          {/* Supervisor section (read-only) — only show if finalized OR has
              content already; drafts may be empty placeholders. */}
          {!isDraft && (
            <>
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
            </>
          )}

          {/* Self-review entry (DRAFT + I-983) */}
          {showSelfForm && (
            <SelfReviewForm
              evaluationId={evaluation.id}
              existing={existing}
              onSaved={onSelfSaved}
            />
          )}

          {/* Existing self-review readout (when finalized — read-only) */}
          {!isDraft && existing && (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                Your self-review
              </div>
              {existing.reflection && (
                <p className="whitespace-pre-wrap text-sm text-sky-900">
                  {existing.reflection}
                </p>
              )}
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-sky-800">
                <SelfBlock label="Overall" value={existing.selfOverallRating} />
                <SelfBlock label="Technical" value={existing.selfTechnicalRating} />
                <SelfBlock label="Growth" value={existing.selfGrowthRating} />
              </div>
              {existing.submittedAt && (
                <p className="mt-2 text-[11px] italic text-sky-700">
                  Submitted {formatRelative(existing.submittedAt)}
                </p>
              )}
            </div>
          )}

          {isDraft && !isI983 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <ClipboardList className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
              This evaluation is still a draft. You&apos;ll see the full
              content here once your supervisor finalizes it.
            </div>
          )}

          {!isDraft && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
              This evaluation is finalized and locked.
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

function SelfReviewForm({
  evaluationId,
  existing,
  onSaved,
}: {
  evaluationId: string;
  existing: EvaluationResponse['selfReview'];
  onSaved: (msg: string) => void;
}) {
  const [reflection, setReflection] = useState(existing?.reflection ?? '');
  const [overall, setOverall] = useState<number>(existing?.selfOverallRating ?? 3);
  const [technical, setTechnical] = useState<number>(
    existing?.selfTechnicalRating ?? 3
  );
  const [growth, setGrowth] = useState<number>(existing?.selfGrowthRating ?? 3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: SubmitSelfReviewRequest = {
        reflection: reflection.trim() ? reflection : undefined,
        selfOverallRating: overall,
        selfTechnicalRating: technical,
        selfGrowthRating: growth,
      };
      await api.put(`/api/v1/evaluations/${evaluationId}/self`, body);
      onSaved(existing ? 'Self-review updated.' : 'Self-review submitted.');
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? "Couldn't save your reflection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-md border border-sky-200 bg-sky-50/40 p-4"
    >
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-800">
        Your self-review
      </h4>
      <p className="mb-3 text-xs text-sky-900/80">
        Reflect on the period: what went well, what you learned, where you want
        to grow next. Your supervisor will see this alongside their evaluation.
      </p>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Reflection
        </label>
        <textarea
          rows={4}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="What were the wins, the hard parts, and the next areas to grow?"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <RatingSlider label="Overall" value={overall} onChange={setOverall} />
        <RatingSlider label="Technical" value={technical} onChange={setTechnical} />
        <RatingSlider label="Growth" value={growth} onChange={setGrowth} />
      </div>

      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          {busy
            ? 'Saving…'
            : existing
              ? 'Update self-review'
              : 'Submit self-review'}
        </button>
      </div>
    </form>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────────

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

function SelfBlock({ label, value }: { label: string; value?: number | null }) {
  if (value == null) return null;
  return (
    <div className="rounded bg-white px-2 py-1 ring-1 ring-sky-200">
      <div className="text-[10px] uppercase tracking-wide text-sky-700">
        {label}
      </div>
      <div className="text-sm font-semibold text-sky-900">{value}/5</div>
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

function RatingSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-sky-800">{value}/5</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
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
