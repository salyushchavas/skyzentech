'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import ExitTypePill from '@/components/exit/ExitTypePill';

interface ExitRecord {
  id: string;
  internLifecycleId: string;
  internId: string;
  internName: string | null;
  internEmail: string | null;
  exitType: string;
  exitDate: string;
  exitReason: string | null;
  initiatedById: string;
  initiatedByName: string | null;
  finalEvaluationId: string | null;
  rehireEligible: boolean | null;
  accessRevocationDone: boolean | null;
  accessRevocationAttemptedAt: string | null;
  accessRevocationSummary: string | null;
  finalDocumentsArchived: boolean | null;
  internVisibleSummary: string | null;
  internalNotes: string | null;
  amendedAt: string | null;
  createdAt: string;
}

interface FeedbackResponse {
  overallRating: number;
  learningRating: number;
  mentorshipRating: number;
  workEnvironmentRating: number;
  whatWentWell: string;
  whatCouldImprove: string;
  wouldRecommend: boolean;
  additionalComments: string | null;
  submittedAt: string;
}

export default function ExitRecordDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = useState<ExitRecord | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [evalIdInput, setEvalIdInput] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await api.get<ExitRecord>(`/api/v1/exit/records/${id}`);
      setRecord(r.data);
      setNotesDraft(r.data.internalNotes ?? '');
      setErr(null);
      try {
        const f = await api.get<FeedbackResponse>(
          `/api/v1/exit/feedback/mine?internId=${r.data.internId}`,
        );
        setFeedback(f.data);
      } catch {
        setFeedback(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load exit record');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function saveNotes() {
    if (!id) return;
    setSavingNotes(true);
    try {
      await api.patch(`/api/v1/exit/records/${id}`, { internalNotes: notesDraft });
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error ?? 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  }

  async function toggleChecklist(itemKey: 'access-revocation' | 'documents-archived',
                                  done: boolean) {
    if (!id) return;
    try {
      await api.post(`/api/v1/exit/records/${id}/checklist/${itemKey}`, { done });
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error ?? 'Failed to update checklist item');
    }
  }

  async function retryRevocation() {
    if (!id) return;
    try {
      await api.post(`/api/v1/exit/records/${id}/retry-revocation`, {});
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error ?? 'Retry failed');
    }
  }

  async function linkFinalEval() {
    if (!id) return;
    if (!evalIdInput.trim()) return;
    try {
      await api.post(`/api/v1/exit/records/${id}/final-evaluation`, {
        evaluationId: evalIdInput.trim(),
      });
      setEvalIdInput('');
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error ?? 'Failed to link evaluation');
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Exit record" />
        <div className="h-32 animate-pulse rounded-lg bg-slate-50" aria-hidden />
      </>
    );
  }
  if (err || !record) {
    return (
      <>
        <PageHeader title="Exit record" />
        <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {err ?? 'Exit record not found'}
        </p>
      </>
    );
  }

  const checklist = [
    {
      label: 'Final evaluation linked',
      done: !!record.finalEvaluationId,
    },
    {
      label: 'GitHub access revoked',
      done: !!record.accessRevocationDone,
    },
    {
      label: 'Documents archived',
      done: !!record.finalDocumentsArchived,
    },
  ];

  return (
    <>
      <Link
        href="/careers/erm/exits"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Exits
      </Link>
      <PageHeader
        title={record.internName ?? 'Exit record'}
        subtitle={record.internEmail ?? undefined}
      />

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ExitTypePill exitType={record.exitType} />
          <span className="text-sm text-slate-700">Effective {record.exitDate}</span>
          <span className="text-xs text-slate-500">
            · Initiated {new Date(record.createdAt).toLocaleString()}
            {record.initiatedByName ? ` by ${record.initiatedByName}` : ''}
          </span>
        </div>
        {record.internVisibleSummary && (
          <p className="mt-3 text-sm text-slate-700">
            <span className="text-[11px] uppercase text-slate-500">Intern-visible summary</span>
            <br />
            {record.internVisibleSummary}
          </p>
        )}
        {record.exitReason && (
          <p className="mt-3 text-sm text-slate-700">
            <span className="text-[11px] uppercase text-slate-500">Reason</span>
            <br />
            {record.exitReason}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Rehire eligible: {record.rehireEligible ? 'Yes' : 'No'}
        </p>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Checklist</h3>
        <ul className="mt-3 space-y-3">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              <span
                className={
                  'inline-flex h-5 w-5 items-center justify-center rounded-full border ' +
                  (c.done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-400')
                }
              >
                {c.done ? '✓' : '•'}
              </span>
              <span className={c.done ? 'text-slate-700' : 'text-slate-500'}>{c.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <p className="text-[11px] uppercase text-slate-500">GitHub revocation</p>
            <p className="mt-1 text-xs text-slate-700">
              {record.accessRevocationSummary ?? 'Not yet attempted.'}
            </p>
            <button
              type="button"
              onClick={retryRevocation}
              className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Retry revocation
            </button>
          </div>
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <p className="text-[11px] uppercase text-slate-500">Documents archived</p>
            <button
              type="button"
              onClick={() => toggleChecklist('documents-archived', !record.finalDocumentsArchived)}
              className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Mark {record.finalDocumentsArchived ? 'not archived' : 'archived'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="text-[11px] uppercase text-slate-500">Final evaluation</p>
          {record.finalEvaluationId ? (
            <p className="mt-1 text-xs text-slate-700">
              Linked: <span className="font-mono">{record.finalEvaluationId}</span>
            </p>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                value={evalIdInput}
                onChange={(e) => setEvalIdInput(e.target.value)}
                placeholder="Final evaluation UUID"
                className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={linkFinalEval}
                className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
              >
                Link
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Intern feedback</h3>
        {!feedback && (
          <p className="mt-2 text-sm text-slate-500">Awaiting intern submission.</p>
        )}
        {feedback && (
          <div className="mt-2 text-sm text-slate-700">
            <div className="flex flex-wrap gap-3 text-xs">
              <span>Overall: <b>{feedback.overallRating}/5</b></span>
              <span>Learning: <b>{feedback.learningRating}/5</b></span>
              <span>Mentorship: <b>{feedback.mentorshipRating}/5</b></span>
              <span>Environment: <b>{feedback.workEnvironmentRating}/5</b></span>
              <span>Would recommend: <b>{feedback.wouldRecommend ? 'Yes' : 'No'}</b></span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] uppercase text-slate-500">What went well</p>
              <p className="mt-1 whitespace-pre-wrap">{feedback.whatWentWell}</p>
            </div>
            <div className="mt-3">
              <p className="text-[11px] uppercase text-slate-500">What could improve</p>
              <p className="mt-1 whitespace-pre-wrap">{feedback.whatCouldImprove}</p>
            </div>
            {feedback.additionalComments && (
              <div className="mt-3">
                <p className="text-[11px] uppercase text-slate-500">Additional comments</p>
                <p className="mt-1 whitespace-pre-wrap">{feedback.additionalComments}</p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Internal notes</h3>
        <p className="text-xs text-slate-500">Visible to ERM/Manager only.</p>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          rows={4}
          className="mt-2 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={saveNotes}
            disabled={savingNotes}
            className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {savingNotes ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </section>
    </>
  );
}
