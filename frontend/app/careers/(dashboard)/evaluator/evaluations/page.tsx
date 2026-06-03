'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Plus,
  Save,
  Star,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  CreateEvaluationRequest,
  EvaluationRecommendation,
  EvaluationResponse,
  EvaluationStatus,
  EvaluationType,
  RubricCriterion,
  UpdateEvaluationRequest,
  Uuid,
} from '@/types';

/**
 * Supervisor evaluations workspace — create / draft / finalize. Reads the
 * intern's COMPLETED projects + weekly cycle stats over the eval period as
 * context.
 *
 * Backed by /api/v1/evaluations.
 */
export default function SupervisorEvaluationsPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_EVALUATOR', 'SUPER_ADMIN']}>
      <DashboardLayout title="Evaluations">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

interface InternRow {
  candidateId: Uuid;
  name: string;
  position: string | null;
  entityName: string | null;
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

const CRITERIA: { key: RubricCriterion; label: string }[] = [
  { key: 'TECHNICAL_SKILLS', label: 'Technical skills' },
  { key: 'CODE_QUALITY', label: 'Code quality' },
  { key: 'COMMUNICATION', label: 'Communication' },
  { key: 'INITIATIVE', label: 'Initiative' },
  { key: 'PROFESSIONALISM', label: 'Professionalism' },
  { key: 'LEARNING', label: 'Learning' },
];

const RECOMMENDATIONS: { key: EvaluationRecommendation; label: string }[] = [
  { key: 'HIGHLY_RECOMMENDED', label: 'Highly recommended' },
  { key: 'RECOMMENDED', label: 'Recommended' },
  { key: 'NEEDS_IMPROVEMENT', label: 'Needs improvement' },
  { key: 'NOT_RECOMMENDED', label: 'Not recommended' },
];

function Body() {
  const [evals, setEvals] = useState<EvaluationResponse[] | null>(null);
  const [interns, setInterns] = useState<InternRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<EvaluationResponse[]>('/api/v1/evaluations/authored');
      setEvals(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load evaluations.");
      setEvals([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<InternRow[]>('/api/v1/supervised/evaluator/interns');
        setInterns(res.data ?? []);
      } catch {
        setInterns([]);
      }
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const open = openId ? evals?.find((e) => e.id === openId) ?? null : null;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Evaluations</h1>
          <p className="mt-1 text-sm text-gray-600">
            Periodic assessments grounded in completed projects and the weekly
            cycle. Draft → finalize to lock.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          New evaluation
        </button>
      </header>

      {toast && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <CreateEvaluationModal
          interns={interns}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setToast('Evaluation drafted.');
            setOpenId(id);
            void load();
          }}
        />
      )}

      {open && (
        <EvaluationDetailModal
          evaluation={open}
          onClose={() => setOpenId(null)}
          onChanged={(msg) => {
            setOpenId(null);
            setToast(msg);
            void load();
          }}
        />
      )}

      {evals === null ? (
        <Skeleton />
      ) : evals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No evaluations yet. Click "New evaluation" to start one.
        </div>
      ) : (
        <ul className="space-y-2">
          {evals.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <EvaluationListRow evaluation={e} onOpen={() => setOpenId(e.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EvaluationListRow({
  evaluation,
  onOpen,
}: {
  evaluation: EvaluationResponse;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {TYPE_LABEL[evaluation.type]}: {evaluation.internName ?? '—'}
          </h3>
          <span
            className={
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
              STATUS_PILL[evaluation.status]
            }
          >
            {evaluation.status}
          </span>
          {evaluation.status === 'FINALIZED' && (
            <Lock className="h-3.5 w-3.5 text-emerald-700" strokeWidth={2} />
          )}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {evaluation.periodStart && (
            <span>
              {formatDateOnly(evaluation.periodStart)}
              {evaluation.periodEnd && ` – ${formatDateOnly(evaluation.periodEnd)}`}
            </span>
          )}
          {evaluation.finalizedAt && (
            <span> · finalized {formatRelative(evaluation.finalizedAt)}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {evaluation.overallRating != null && (
          <RatingStars value={evaluation.overallRating} size={14} />
        )}
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Open
        </button>
      </div>
    </div>
  );
}

function RatingStars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
          style={{ width: size, height: size }}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

// ── Create modal ────────────────────────────────────────────────────────────

function CreateEvaluationModal({
  interns,
  onClose,
  onCreated,
}: {
  interns: InternRow[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [candidateId, setCandidateId] = useState<string>(interns[0]?.candidateId ?? '');
  const [type, setType] = useState<EvaluationType>('MIDPOINT');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateEvaluationRequest = {
        candidateId,
        type,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      };
      const res = await api.post<EvaluationResponse>('/api/v1/evaluations', body);
      onCreated(res.data.id);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't create the evaluation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-lg font-semibold text-gray-900">New evaluation</h3>
        <div className="space-y-3">
          <Field label="Intern" required>
            <select
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {interns.length === 0 ? (
                <option value="">No supervised interns</option>
              ) : (
                interns.map((it) => (
                  <option key={it.candidateId} value={it.candidateId}>
                    {it.name}
                    {it.position ? ` — ${it.position}` : ''}
                  </option>
                ))
              )}
            </select>
          </Field>
          <Field label="Type" required>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EvaluationType)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {Object.entries(TYPE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Period start">
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>
            <Field label="Period end">
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || interns.length === 0}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Detail modal — eval form + context ─────────────────────────────────────

function EvaluationDetailModal({
  evaluation,
  onClose,
  onChanged,
}: {
  evaluation: EvaluationResponse;
  onClose: () => void;
  onChanged: (toast: string) => void;
}) {
  const locked = evaluation.status === 'FINALIZED';

  const [overall, setOverall] = useState<number>(evaluation.overallRating ?? 0);
  const [strengths, setStrengths] = useState(evaluation.strengths ?? '');
  const [areas, setAreas] = useState(evaluation.areasForImprovement ?? '');
  const [comments, setComments] = useState(evaluation.comments ?? '');
  const [recommendation, setRecommendation] = useState<EvaluationRecommendation | ''>(
    evaluation.recommendation ?? '',
  );
  const [rubric, setRubric] = useState<Record<RubricCriterion, number>>(() => {
    const init: Record<string, number> = {};
    for (const c of CRITERIA) init[c.key] = 0;
    for (const r of evaluation.rubric) init[r.criterion] = r.score;
    return init as Record<RubricCriterion, number>;
  });
  const [busy, setBusy] = useState<'save' | 'finalize' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveDraft = async () => {
    if (locked) return;
    setBusy('save');
    setError(null);
    try {
      const body: UpdateEvaluationRequest = {
        overallRating: overall || undefined,
        strengths,
        areasForImprovement: areas,
        comments,
        recommendation: recommendation || undefined,
        rubric: CRITERIA.map((c) => ({ criterion: c.key, score: rubric[c.key] || 1 })),
      };
      await api.put(`/api/v1/evaluations/${evaluation.id}`, body);
      onChanged('Draft saved.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't save the draft.");
    } finally {
      setBusy(null);
    }
  };

  const finalize = async () => {
    if (locked) return;
    if (!overall) {
      setError('Set an overall rating before finalizing.');
      return;
    }
    setBusy('finalize');
    setError(null);
    try {
      // Save current form state first so the finalized record reflects the
      // edits the supervisor is staring at.
      const body: UpdateEvaluationRequest = {
        overallRating: overall,
        strengths,
        areasForImprovement: areas,
        comments,
        recommendation: recommendation || undefined,
        rubric: CRITERIA.map((c) => ({ criterion: c.key, score: rubric[c.key] || 1 })),
      };
      await api.put(`/api/v1/evaluations/${evaluation.id}`, body);
      await api.post(`/api/v1/evaluations/${evaluation.id}/finalize`);
      onChanged('Evaluation finalized.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't finalize.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {TYPE_LABEL[evaluation.type]}: {evaluation.internName ?? '—'}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {evaluation.periodStart && (
                <>
                  {formatDateOnly(evaluation.periodStart)}
                  {evaluation.periodEnd && ` – ${formatDateOnly(evaluation.periodEnd)}`}
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
            {evaluation.status}
          </span>
        </div>

        <div className="grid max-h-[75vh] grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-3">
          {/* Form (2/3) */}
          <div className="space-y-4 lg:col-span-2">
            <fieldset disabled={locked} className="space-y-4">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Rubric (1–5 per criterion)
                </div>
                <ul className="space-y-2">
                  {CRITERIA.map((c) => (
                    <li key={c.key} className="flex items-center gap-3">
                      <span className="w-40 text-sm text-gray-700">{c.label}</span>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={rubric[c.key] || 1}
                        onChange={(e) =>
                          setRubric((curr) => ({
                            ...curr,
                            [c.key]: Number(e.target.value),
                          }))
                        }
                        className="flex-1"
                        aria-label={c.label}
                      />
                      <span className="w-6 text-right text-sm font-semibold text-gray-900">
                        {rubric[c.key] || 1}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <Field label="Overall rating">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={5}
                    value={overall}
                    onChange={(e) => setOverall(Number(e.target.value))}
                    className="flex-1"
                  />
                  <RatingStars value={overall} />
                  <span className="text-sm font-semibold text-gray-900">{overall}</span>
                </div>
              </Field>

              <Field label="Strengths">
                <textarea
                  rows={3}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </Field>
              <Field label="Areas for improvement">
                <textarea
                  rows={3}
                  value={areas}
                  onChange={(e) => setAreas(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </Field>
              <Field label="Additional comments">
                <textarea
                  rows={2}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </Field>
              <Field label="Recommendation">
                <select
                  value={recommendation}
                  onChange={(e) =>
                    setRecommendation(e.target.value as EvaluationRecommendation | '')
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">—</option>
                  {RECOMMENDATIONS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
            </fieldset>
            {error && <p className="text-sm text-red-700">{error}</p>}
            {locked && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <Lock className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
                Finalized {evaluation.finalizedAt ? formatRelative(evaluation.finalizedAt) : ''}
                — locked.
              </div>
            )}

            {evaluation.selfReview && (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                <div className="mb-1 font-semibold">Intern self-review</div>
                {evaluation.selfReview.reflection && (
                  <p className="whitespace-pre-wrap">{evaluation.selfReview.reflection}</p>
                )}
                <div className="mt-1 text-[11px] text-sky-800">
                  Self overall: {evaluation.selfReview.selfOverallRating ?? '—'} ·
                  technical: {evaluation.selfReview.selfTechnicalRating ?? '—'} ·
                  growth: {evaluation.selfReview.selfGrowthRating ?? '—'}
                </div>
              </div>
            )}
          </div>

          {/* Context (1/3) */}
          <aside className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-3 lg:col-span-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Period context
            </div>
            {evaluation.context ? (
              <>
                <div>
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                    Completed projects · {evaluation.context.completedProjects.length}
                  </div>
                  {evaluation.context.completedProjects.length === 0 ? (
                    <p className="text-xs text-gray-500">None in period.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {evaluation.context.completedProjects.map((p) => (
                        <li key={p.id} className="text-gray-700">
                          {p.title}
                          {p.completedDate && (
                            <span className="text-gray-500"> · {formatDateOnly(p.completedDate)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-700">
                    <Clock className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                    Weekly reports
                  </div>
                  <ul className="space-y-0.5 text-xs text-gray-700">
                    <li>Total: {evaluation.context.reportStats.totalCount}</li>
                    <li>Approved: {evaluation.context.reportStats.approvedCount}</li>
                    <li>Returned: {evaluation.context.reportStats.returnedCount}</li>
                    <li>Pending: {evaluation.context.reportStats.pendingCount}</li>
                  </ul>
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-700">
                    <Clock className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                    Timesheets
                  </div>
                  <ul className="space-y-0.5 text-xs text-gray-700">
                    <li>Total: {evaluation.context.timesheetStats.totalCount}</li>
                    <li>Approved: {evaluation.context.timesheetStats.approvedCount}</li>
                    <li>Approved hours: {evaluation.context.timesheetStats.approvedHours}</li>
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-xs italic text-gray-500">No context available.</p>
            )}
          </aside>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          {!locked && (
            <>
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
                {busy === 'save' ? 'Saving…' : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={() => void finalize()}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                {busy === 'finalize' ? 'Finalizing…' : 'Finalize'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-16 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="h-16 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
    </div>
  );
}
