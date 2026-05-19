'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Ban,
  CheckCircle,
  Clock,
  FilePlus,
  FileText,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import StatCard from '@/components/preview/StatCard';
import OfferStatusBadge from '@/components/offers/OfferStatusBadge';
import CompensationDisplay from '@/components/offers/CompensationDisplay';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly, formatRelative, isPast } from '@/lib/format-date';
import type {
  OfferResponse,
  OfferStatus,
  OfferSummaryResponse,
  Page,
} from '@/types';

const FILTER_OPTIONS: { key: 'ALL' | OfferStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SENT', label: 'Sent' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'REVOKED', label: 'Revoked' },
];

const MS_30_DAYS = 30 * 86_400_000;

export default function HrOffersPage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'ERM', 'ADMIN']}>
      <DashboardLayout title="Offer Letters">
        <Suspense fallback={<Spinner />}>
          <OffersBody />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div
        aria-label="Loading"
        className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"
      />
    </div>
  );
}

function OffersBody() {
  const router = useRouter();
  const search = useSearchParams();
  const activeFilter = (search.get('status') ?? 'ALL') as 'ALL' | OfferStatus;

  const [offers, setOffers] = useState<OfferSummaryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<null | {
    kind: 'send' | 'delete' | 'revoke';
    offer: OfferSummaryResponse;
  }>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Page<OfferSummaryResponse>>('/api/v1/offers', {
        params: { size: 200 },
      });
      setOffers(res.data?.content ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load offers.");
      setOffers(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setFilter(next: 'ALL' | OfferStatus) {
    const params = new URLSearchParams(search.toString());
    if (next === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', next);
    }
    const qs = params.toString();
    router.replace(qs ? `/careers/hr/offers?${qs}` : '/careers/hr/offers');
  }

  const filtered = useMemo(() => {
    if (!offers) return [];
    if (activeFilter === 'ALL') return offers;
    return offers.filter((o) => o.status === activeFilter);
  }, [offers, activeFilter]);

  const stats = useMemo(() => {
    if (!offers) {
      return { pending: 0, acceptedRecent: 0, declinedRecent: 0, drafts: 0 };
    }
    // Summary rows don't carry respondedAt, so "Accepted/Declined (30d)" falls
    // back to createdAt as a proxy for "recent" until we add respondedAt.
    const now = Date.now();
    let pending = 0;
    let acceptedRecent = 0;
    let declinedRecent = 0;
    let drafts = 0;
    for (const o of offers) {
      if (o.status === 'SENT') pending += 1;
      else if (o.status === 'DRAFT') drafts += 1;
      else if (o.status === 'ACCEPTED' || o.status === 'DECLINED') {
        const created = new Date(o.createdAt).getTime();
        if (Number.isFinite(created) && now - created < MS_30_DAYS) {
          if (o.status === 'ACCEPTED') acceptedRecent += 1;
          else declinedRecent += 1;
        }
      }
    }
    return { pending, acceptedRecent, declinedRecent, drafts };
  }, [offers]);

  async function runConfirmedAction() {
    if (!confirming) return;
    const { kind, offer } = confirming;
    try {
      if (kind === 'send') {
        await api.post(`/api/v1/offers/${offer.id}/send`);
        toast.success('Offer sent');
      } else if (kind === 'revoke') {
        await api.post(`/api/v1/offers/${offer.id}/revoke`);
        toast.success('Offer revoked');
      } else if (kind === 'delete') {
        await api.delete(`/api/v1/offers/${offer.id}`);
        toast.success('Draft deleted');
      }
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Action failed');
    } finally {
      setConfirming(null);
    }
  }

  function confirmDescription(): string {
    if (!confirming) return '';
    const name = confirming.offer.candidateName ?? 'the candidate';
    if (confirming.kind === 'send') {
      return `${name} will be notified and can respond until ${formatDateOnly(
        confirming.offer.expiresAt
      )}. The offer cannot be edited after sending — but you can revoke it.`;
    }
    if (confirming.kind === 'revoke') {
      return `This will withdraw the offer to ${name}. The candidate will see the offer as revoked.`;
    }
    return 'This will permanently delete the draft offer. This action cannot be undone.';
  }

  return (
    <>
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_OPTIONS.map((opt) => {
            const active = activeFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(opt.key)}
                className={
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
                  (active
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <Link
          href="/careers/hr/offers/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark"
        >
          <FilePlus className="h-4 w-4" strokeWidth={2} />
          Create Offer
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending Acceptance" value={stats.pending} icon={Clock} />
        <StatCard
          label="Accepted (30d)"
          value={stats.acceptedRecent}
          icon={CheckCircle}
        />
        <StatCard
          label="Declined (30d)"
          value={stats.declinedRecent}
          icon={XCircle}
        />
        <StatCard label="Drafts" value={stats.drafts} icon={FileText} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

      {/* Loading */}
      {offers === null && !error && <LoadingSkeleton />}

      {/* Empty */}
      {offers !== null && filtered.length === 0 && !error && (
        <EmptyState filter={activeFilter} />
      )}

      {/* List */}
      {filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white md:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Compensation</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/careers/hr/offers/${o.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {o.candidateName ?? '(unnamed)'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {o.jobPostingTitle ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {o.entityName ? (
                        <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {o.entityName}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CompensationDisplay
                        amount={o.compensationAmount}
                        frequency={o.compensationFrequency}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDateOnly(o.startDate)}
                    </td>
                    <td className="px-4 py-3">
                      <OfferStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <ExpiresLabel status={o.status} expiresAt={o.expiresAt} />
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowActions
                        offer={o}
                        onConfirm={(kind) => setConfirming({ kind, offer: o })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((o) => (
              <div
                key={o.id}
                onClick={() => router.push(`/careers/hr/offers/${o.id}`)}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900">
                      {o.candidateName ?? '(unnamed)'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {o.jobPostingTitle ?? '—'}
                    </div>
                  </div>
                  <OfferStatusBadge status={o.status} />
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <CompensationDisplay
                    amount={o.compensationAmount}
                    frequency={o.compensationFrequency}
                  />
                  <span>·</span>
                  <span>Start {formatDateOnly(o.startDate)}</span>
                </div>
                <div className="mb-3 text-xs text-gray-500">
                  <ExpiresLabel status={o.status} expiresAt={o.expiresAt} />
                </div>
                <div
                  className="flex flex-wrap items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RowActions
                    offer={o}
                    onConfirm={(kind) => setConfirming({ kind, offer: o })}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={runConfirmedAction}
        title={
          confirming?.kind === 'send'
            ? 'Send this offer?'
            : confirming?.kind === 'revoke'
              ? 'Revoke this offer?'
              : 'Delete this draft?'
        }
        description={confirmDescription()}
        confirmLabel={
          confirming?.kind === 'send'
            ? 'Send Offer'
            : confirming?.kind === 'revoke'
              ? 'Revoke'
              : 'Delete'
        }
        variant={confirming?.kind === 'send' ? 'primary' : 'danger'}
      />
    </>
  );
}

function ExpiresLabel({
  status,
  expiresAt,
}: {
  status: OfferStatus;
  expiresAt: string;
}) {
  if (status === 'SENT') {
    const expired = isPast(expiresAt);
    const cutoff = Date.now() + 2 * 86_400_000;
    const closeSoon = new Date(expiresAt).getTime() < cutoff;
    return (
      <span
        className={
          expired
            ? 'text-amber-700'
            : closeSoon
              ? 'text-amber-600'
              : 'text-gray-600'
        }
      >
        {formatRelative(expiresAt)}
      </span>
    );
  }
  if (status === 'EXPIRED') {
    return (
      <span className="text-gray-500">Expired {formatDateOnly(expiresAt)}</span>
    );
  }
  return <span className="text-gray-400">—</span>;
}

function RowActions({
  offer,
  onConfirm,
}: {
  offer: OfferSummaryResponse;
  onConfirm: (kind: 'send' | 'delete' | 'revoke') => void;
}) {
  const status = offer.status;
  if (status === 'DRAFT') {
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <Link
          href={`/careers/hr/offers/${offer.id}/edit`}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => onConfirm('send')}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent-dark"
        >
          <Send className="h-3 w-3" strokeWidth={2} />
          Send
        </button>
        <button
          type="button"
          onClick={() => onConfirm('delete')}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" strokeWidth={2} />
          Delete
        </button>
      </div>
    );
  }
  if (status === 'SENT') {
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <Link
          href={`/careers/hr/offers/${offer.id}`}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          View
        </Link>
        <button
          type="button"
          onClick={() => onConfirm('revoke')}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          <Ban className="h-3 w-3" strokeWidth={2} />
          Revoke
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Link
        href={`/careers/hr/offers/${offer.id}`}
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        View
      </Link>
    </div>
  );
}

function EmptyState({ filter }: { filter: 'ALL' | OfferStatus }) {
  const label =
    filter === 'ALL'
      ? 'No offers yet'
      : filter === 'DRAFT'
        ? 'No drafts'
        : filter === 'SENT'
          ? 'No sent offers'
          : filter === 'ACCEPTED'
            ? 'No accepted offers'
            : filter === 'DECLINED'
              ? 'No declined offers'
              : filter === 'EXPIRED'
                ? 'No expired offers'
                : 'No revoked offers';
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
      <p className="mb-4 text-base font-medium text-gray-700">{label}</p>
      <Link
        href="/careers/hr/offers/new"
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
      >
        <FilePlus className="h-4 w-4" strokeWidth={2} />
        Create Offer
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="space-y-1 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
            <div className="ml-auto h-7 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
