'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Bell,
  Download,
  Edit,
  Mail,
  Send,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import OfferStatusBadge from '@/components/offers/OfferStatusBadge';
import CompensationDisplay from '@/components/offers/CompensationDisplay';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly, formatFull, formatRelative, isPast } from '@/lib/format-date';
import type { OfferResponse } from '@/types';

type ActionKind = 'send' | 'revoke' | 'delete';

export default function OfferDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'HR']}>
      <DashboardLayout title="Offer Details">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams();
  const router = useRouter();
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : null;

  const [offer, setOffer] = useState<OfferResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ActionKind | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<OfferResponse>(`/api/v1/offers/${id}`);
      setOffer(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not load offer');
      setOffer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runConfirmedAction() {
    if (!offer || !confirm) return;
    try {
      if (confirm === 'send') {
        await api.post(`/api/v1/offers/${offer.id}/send`);
        toast.success('Offer sent');
        await load();
      } else if (confirm === 'revoke') {
        await api.post(`/api/v1/offers/${offer.id}/revoke`);
        toast.success('Offer revoked');
        await load();
      } else if (confirm === 'delete') {
        await api.delete(`/api/v1/offers/${offer.id}`);
        toast.success('Draft deleted');
        router.push('/careers/hr/offers');
        return;
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Action failed');
    } finally {
      setConfirm(null);
    }
  }

  async function downloadLetter() {
    if (!offer) return;
    setDownloading(true);
    try {
      const res = await api.get(`/api/v1/offers/${offer.id}/download`, {
        responseType: 'blob',
      });
      const ctRaw = res.headers['content-type'];
      const contentType =
        typeof ctRaw === 'string' ? ctRaw : 'text/plain; charset=utf-8';
      const blob = new Blob([res.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cdRaw = res.headers['content-disposition'];
      const cd = typeof cdRaw === 'string' ? cdRaw : '';
      const m = cd.match(/filename="?([^";]+)"?/);
      a.download = m?.[1] ?? `Offer-${offer.id.slice(0, 8)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <DetailSkeleton />;

  if (error && !offer) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
          >
            Retry
          </button>
          <Link
            href="/careers/hr/offers"
            className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
          >
            Back to offers
          </Link>
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="mb-4 text-base font-medium text-gray-700">Offer not found.</p>
        <Link
          href="/careers/hr/offers"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to offers
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/careers/hr/offers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to offers
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT — info card */}
        <aside className="lg:col-span-1 lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <OfferStatusBadge status={offer.status} size="md" />
              <div className="text-xs text-gray-400">
                Offer #{offer.id.slice(0, 8)}
              </div>
            </div>

            <div className="my-4 h-px bg-gray-100" />

            <FieldGroup label="Candidate">
              <div className="text-lg font-semibold text-gray-900">
                {offer.candidateName ?? '(unnamed)'}
              </div>
              {offer.candidateEmail && (
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                  {offer.candidateEmail}
                </div>
              )}
            </FieldGroup>

            <FieldGroup label="Position">
              <div className="text-sm text-gray-700">
                {offer.jobPostingTitle ?? '—'}
              </div>
              {offer.entityName && (
                <span className="mt-1.5 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {offer.entityName}
                </span>
              )}
            </FieldGroup>

            <FieldGroup label="Compensation">
              <CompensationDisplay
                amount={offer.compensationAmount}
                frequency={offer.compensationFrequency}
                currency={offer.compensationCurrency}
                variant="large"
              />
            </FieldGroup>

            <FieldGroup label="Start date">
              <div className="text-sm text-gray-700">
                {formatDateOnly(offer.startDate)}
              </div>
            </FieldGroup>

            {offer.expectedEndDate && (
              <FieldGroup label="End date">
                <div className="text-sm text-gray-700">
                  {formatDateOnly(offer.expectedEndDate)}
                </div>
              </FieldGroup>
            )}

            <FieldGroup label="Lifecycle">
              <LifecycleRow offer={offer} />
            </FieldGroup>

            <div className="my-4 h-px bg-gray-100" />

            <div className="space-y-1 text-xs text-gray-400">
              <div>
                Created by{' '}
                <span className="text-gray-600">
                  {offer.createdByName ?? '—'}
                </span>{' '}
                on {formatFull(offer.createdAt)}
              </div>
              <div>Last updated {formatFull(offer.updatedAt)}</div>
            </div>
          </div>
        </aside>

        {/* RIGHT — letter + actions */}
        <div className="lg:col-span-2">
          {/* Letter preview */}
          <section className="rounded-lg border border-gray-200 bg-white p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">
                Offer Letter
              </h2>
              <button
                type="button"
                onClick={() => void downloadLetter()}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                {downloading ? 'Downloading…' : 'Download'}
              </button>
            </div>
            <LetterPreview content={offer.letterContent} />
          </section>

          {/* Actions */}
          <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-medium text-gray-900">Actions</h3>
            <ActionPanel
              offer={offer}
              onAction={(kind) => setConfirm(kind)}
              onResendNote={() =>
                toast('Email reminders coming soon', { icon: '📨' })
              }
            />
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmedAction}
        title={
          confirm === 'send'
            ? 'Send this offer?'
            : confirm === 'revoke'
              ? 'Revoke this offer?'
              : 'Delete this draft?'
        }
        description={
          confirm === 'send'
            ? `${offer.candidateName ?? 'The candidate'} will have until ${formatFull(
                offer.expiresAt
              )} to respond. The offer cannot be edited after sending. Revoke is available if needed.`
            : confirm === 'revoke'
              ? `This will withdraw the offer to ${
                  offer.candidateName ?? 'the candidate'
                }. The candidate will see the offer as revoked.`
              : 'This will permanently delete the draft offer. This action cannot be undone.'
        }
        confirmLabel={
          confirm === 'send'
            ? 'Send Offer'
            : confirm === 'revoke'
              ? 'Revoke'
              : 'Delete'
        }
        variant={confirm === 'send' ? 'primary' : 'danger'}
      />
    </>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function LifecycleRow({ offer }: { offer: OfferResponse }) {
  if (offer.status === 'SENT') {
    const expired = isPast(offer.expiresAt);
    const closeSoon = new Date(offer.expiresAt).getTime() < Date.now() + 2 * 86_400_000;
    return (
      <div
        className={
          'text-sm ' +
          (expired
            ? 'text-amber-700'
            : closeSoon
              ? 'text-amber-600'
              : 'text-gray-700')
        }
      >
        Expires {formatRelative(offer.expiresAt)}
      </div>
    );
  }
  if (offer.status === 'ACCEPTED') {
    return (
      <div className="text-sm text-gray-700">
        Accepted on {formatFull(offer.respondedAt)}
      </div>
    );
  }
  if (offer.status === 'DECLINED') {
    return (
      <div className="text-sm text-gray-700">
        <div>Declined on {formatFull(offer.respondedAt)}</div>
        {offer.declineReason && (
          <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-gray-300 bg-gray-50 px-3 py-2 text-xs italic text-gray-600">
            {offer.declineReason}
          </p>
        )}
      </div>
    );
  }
  if (offer.status === 'EXPIRED') {
    return (
      <div className="text-sm text-gray-700">
        Expired {formatFull(offer.expiresAt)}
      </div>
    );
  }
  if (offer.status === 'REVOKED') {
    return (
      <div className="text-sm text-gray-700">
        Revoked on {formatFull(offer.revokedAt)}
      </div>
    );
  }
  // DRAFT
  return (
    <div className="text-sm text-gray-700">
      Not sent yet — will expire {formatRelative(offer.expiresAt)}
    </div>
  );
}

function LetterPreview({ content }: { content: string }) {
  const paragraphs = useMemo(() => (content ?? '').split(/\n\n+/), [content]);
  return (
    <article className="mx-auto max-w-prose space-y-4 text-sm leading-relaxed text-gray-800">
      {paragraphs.map((p, i) => {
        const lines = p.split('\n');
        const isBulletList = lines.every(
          (l) => l.trim().startsWith('•') || l.trim() === ''
        );
        if (isBulletList) {
          return (
            <ul key={i} className="ml-2 space-y-1">
              {lines
                .filter((l) => l.trim() !== '')
                .map((l, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{l.replace(/^\s*•\s*/, '')}</span>
                  </li>
                ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {p}
          </p>
        );
      })}
    </article>
  );
}

function ActionPanel({
  offer,
  onAction,
  onResendNote,
}: {
  offer: OfferResponse;
  onAction: (kind: ActionKind) => void;
  onResendNote: () => void;
}) {
  if (offer.status === 'DRAFT') {
    return (
      <div className="space-y-2">
        <Link
          href={`/careers/hr/offers/${offer.id}/edit`}
          className="flex w-full items-center justify-between rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          <span className="inline-flex items-center gap-2">
            <Edit className="h-4 w-4" strokeWidth={2} />
            Edit Offer
          </span>
        </Link>
        <button
          type="button"
          onClick={() => onAction('send')}
          className="flex w-full items-center justify-between rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          <span className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" strokeWidth={2} />
            Send to Candidate
          </span>
        </button>
        <button
          type="button"
          onClick={() => onAction('delete')}
          className="flex w-full items-center justify-between rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <span className="inline-flex items-center gap-2">
            <Trash2 className="h-4 w-4" strokeWidth={2} />
            Delete Offer
          </span>
        </button>
      </div>
    );
  }
  if (offer.status === 'SENT') {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onAction('revoke')}
          className="flex w-full items-center justify-between rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <span className="inline-flex items-center gap-2">
            <Ban className="h-4 w-4" strokeWidth={2} />
            Revoke Offer
          </span>
        </button>
        <button
          type="button"
          onClick={onResendNote}
          className="flex w-full items-center justify-between rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          <span className="inline-flex items-center gap-2">
            <Bell className="h-4 w-4" strokeWidth={2} />
            Resend Reminder
          </span>
        </button>
      </div>
    );
  }
  // ACCEPTED / DECLINED / EXPIRED / REVOKED
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        This offer is in a terminal state and cannot be modified.
      </p>
      <Link
        href={`/careers/hr/offers/new?fromApplication=${offer.applicationId}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Create a new offer
      </Link>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
        <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="space-y-6 lg:col-span-2">
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-8">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-10/12 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
        </div>
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-6">
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
