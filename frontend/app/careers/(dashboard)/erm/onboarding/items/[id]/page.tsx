'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import OnboardingStatusPill from '@/components/erm/onboarding/OnboardingStatusPill';
import ReviewItemModal from '@/components/erm/onboarding/ReviewItemModal';
import {
  CATEGORY_LABEL,
  type ItemDetail,
} from '@/components/erm/onboarding/types';

type RouteParams = { id: string };

export default function OnboardingItemDetailPage(props: {
  params: Promise<RouteParams>;
}) {
  const { id } = use(props.params);
  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <Body id={id} />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body({ id }: { id: string }) {
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ItemDetail>(
        `/api/v1/erm/onboarding/items/${id}`,
      );
      setDetail(res.data);
      setNoteText(res.data.internalNotes ?? '');
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Failed to load item');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await api.post<ItemDetail>(
        `/api/v1/erm/onboarding/items/${id}/internal-note`,
        { internalNotes: noteText.trim() },
      );
      setDetail(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Save failed');
    } finally {
      setSavingNote(false);
    }
  }

  if (err) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        {err}
      </p>
    );
  }
  if (!detail) {
    return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  }

  const reviewable = detail.status === 'SUBMITTED';

  return (
    <>
      <PageHeader
        title={CATEGORY_LABEL[detail.category] ?? detail.category}
        subtitle={`${detail.applicantName ?? 'unknown'} · ${detail.applicantEmail ?? ''}`}
      />

      <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <OnboardingStatusPill status={detail.status} />
          {detail.submittedAt && (
            <span className="text-xs text-slate-500">
              Submitted {new Date(detail.submittedAt).toLocaleString()}
            </span>
          )}
          <span className="text-xs text-slate-500">
            {detail.reviewCount ?? 0} review
            {(detail.reviewCount ?? 0) === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href="/careers/erm/onboarding"
            className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            ← Queue
          </Link>
          <button
            type="button"
            disabled={!reviewable}
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Review
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Form data
          </h3>
          <FormDataViewer data={detail.formData} />
        </section>

        <section className="space-y-4">
          {detail.ermComments && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1 text-xs font-semibold text-amber-800">
                Last applicant-visible comments
              </p>
              <p className="whitespace-pre-wrap text-sm text-amber-900">
                {detail.ermComments}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              Internal notes
              <span className="ml-2 text-[10px] font-normal text-rose-600">
                ERM-only
              </span>
            </h3>
            <textarea
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="block w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                disabled={savingNote || !noteText.trim()}
                onClick={() => void saveNote()}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {savingNote ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Review history
            </h3>
            {detail.history.length === 0 ? (
              <p className="text-xs text-slate-500">No prior reviews.</p>
            ) : (
              <ul className="space-y-3">
                {detail.history.map((h) => (
                  <li
                    key={h.id}
                    className="border-l-2 border-slate-200 pl-3 text-xs text-slate-700"
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {h.decision}
                      {h.reasonCode && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {h.reasonCode}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {h.actorName ?? 'unknown'} ·{' '}
                      {new Date(h.createdAt).toLocaleString()} ·{' '}
                      {h.previousStatus} → {h.newStatus}
                    </div>
                    {h.reasonText && (
                      <p className="mt-1 whitespace-pre-wrap text-[12px] text-slate-700">
                        {h.reasonText}
                      </p>
                    )}
                    {h.ermCommentsSnapshot && (
                      <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                        “{h.ermCommentsSnapshot}”
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {modalOpen && (
        <ReviewItemModal
          item={detail}
          onClose={() => setModalOpen(false)}
          onDone={(updated) => {
            setDetail(updated);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}

function FormDataViewer({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No structured form data submitted yet.
      </p>
    );
  }
  return (
    <dl className="space-y-2 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {k}
          </dt>
          <dd className="break-words text-slate-800">
            {typeof v === 'object' ? (
              <code className="text-xs">{JSON.stringify(v)}</code>
            ) : (
              String(v ?? '')
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
