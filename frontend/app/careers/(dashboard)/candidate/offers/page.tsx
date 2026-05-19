'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import OfferStatusBadge from '@/components/offers/OfferStatusBadge';
import CompensationDisplay from '@/components/offers/CompensationDisplay';
import OfferCountdown from '@/components/offers/OfferCountdown';
import { formatDateOnly, formatFull } from '@/lib/format-date';
import type { CandidateOfferResponse, OfferStatus } from '@/types';

export default function CandidateOffersPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="My Offers">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const router = useRouter();
  const [offers, setOffers] = useState<CandidateOfferResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<CandidateOfferResponse[]>('/api/v1/offers/me');
      setOffers(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your offers.");
      setOffers(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => sortForDisplay(offers ?? []), [offers]);

  if (offers === null && !error) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (offers && offers.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="max-w-3xl">
      {offers && offers.length > 1 && (
        <p className="mb-4 text-sm text-gray-600">
          You have {offers.length} offers
        </p>
      )}

      <div className="flex flex-col gap-4">
        {sorted.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => router.push(`/careers/candidate/offers/${o.id}`)}
            className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-6 text-left transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-gray-900">
                  {o.jobPostingTitle ?? '(untitled position)'}
                </div>
                {o.entityName && (
                  <div className="text-sm text-gray-500">{o.entityName}</div>
                )}
              </div>
              <OfferStatusBadge status={o.status} size="md" />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-700">
              <CompensationDisplay
                amount={o.compensationAmount}
                frequency={o.compensationFrequency}
                currency={o.compensationCurrency}
                variant="large"
              />
              <span className="text-gray-300">·</span>
              <span className="text-gray-600">
                Starting {formatDateOnly(o.startDate)}
              </span>
            </div>

            <div className="mt-4">
              <StatusFootnote offer={o} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusFootnote({ offer }: { offer: CandidateOfferResponse }) {
  const status = offer.status;

  if (status === 'SENT' && !offer.expired) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <OfferCountdown expiresAt={offer.expiresAt} />
        <span className="text-xs text-gray-500">
          Click to review and respond
        </span>
      </div>
    );
  }
  if (status === 'ACCEPTED') {
    return (
      <p className="text-sm text-green-700">
        ✓ Accepted on {formatFull(offer.respondedAt)}
      </p>
    );
  }
  if (status === 'DECLINED') {
    return (
      <p className="text-sm text-gray-500">
        Declined on {formatFull(offer.respondedAt)}
      </p>
    );
  }
  if (status === 'EXPIRED' || (status === 'SENT' && offer.expired)) {
    return (
      <p className="text-sm text-amber-700">
        Expired {formatFull(offer.expiresAt)}
      </p>
    );
  }
  if (status === 'REVOKED') {
    return (
      <p className="text-sm text-red-700">Withdrawn by the hiring team</p>
    );
  }
  return null;
}

function statusGroup(s: OfferStatus): number {
  if (s === 'SENT') return 0;
  if (s === 'ACCEPTED' || s === 'DECLINED') return 1;
  return 2;
}

function statusSortKey(o: CandidateOfferResponse): number {
  if (o.status === 'SENT') {
    return o.sentAt ? new Date(o.sentAt).getTime() : 0;
  }
  if (o.status === 'ACCEPTED' || o.status === 'DECLINED') {
    return o.respondedAt ? new Date(o.respondedAt).getTime() : 0;
  }
  return o.expiresAt ? new Date(o.expiresAt).getTime() : 0;
}

function sortForDisplay(
  offers: CandidateOfferResponse[]
): CandidateOfferResponse[] {
  return [...offers].sort((a, b) => {
    const gA = statusGroup(a.status);
    const gB = statusGroup(b.status);
    if (gA !== gB) return gA - gB;
    return statusSortKey(b) - statusSortKey(a);
  });
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Briefcase className="mx-auto h-16 w-16 text-gray-300" strokeWidth={1.5} />
      <h2 className="mt-4 text-xl font-semibold text-gray-900">No offers yet</h2>
      <p className="mt-2 text-sm text-gray-500">
        Keep applying — we&apos;ll notify you when an offer is extended.
      </p>
      <Link
        href="/careers/openings"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-accent-dark px-5 py-2.5 text-sm font-semibold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg"
      >
        Browse internships
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl">
      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-lg border border-gray-200 bg-white p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
            </div>
            <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
