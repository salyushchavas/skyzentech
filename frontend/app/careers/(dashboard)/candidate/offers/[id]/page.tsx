'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle,
  Clock,
  Download,
  Sparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ConfirmDialog from '@/components/ConfirmDialog';
import OfferStatusBadge from '@/components/offers/OfferStatusBadge';
import CompensationDisplay from '@/components/offers/CompensationDisplay';
import OfferCountdown from '@/components/offers/OfferCountdown';
import DeclineOfferDialog from '@/components/offers/DeclineOfferDialog';
import { formatDateOnly, formatFull } from '@/lib/format-date';
import type { CandidateOfferResponse } from '@/types';

export default function CandidateOfferDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="Offer Details">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams();
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : null;

  const [offer, setOffer] = useState<CandidateOfferResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await api.get<CandidateOfferResponse>(`/api/v1/offers/${id}`);
      setOffer(res.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err?.response?.data?.error ?? 'Could not load offer');
      }
      setOffer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAccept() {
    if (!offer) return;
    try {
      await api.post(`/api/v1/offers/${offer.id}/accept`);
      toast.success(
        `🎉 Congratulations! You've accepted the offer from ${offer.entityName ?? 'the hiring team'}.`,
        { duration: 5000 }
      );
      toast(
        'Your onboarding tasks will appear under "Onboarding" shortly.',
        { icon: '📋', duration: 5000 }
      );
      setAcceptOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not accept offer');
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
      a.download = m?.[1] ?? 'offer-letter.txt';
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

  if (notFound) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="mb-4 text-base font-medium text-gray-700">
          Offer not found.
        </p>
        <Link
          href="/careers/candidate/offers"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to my offers
        </Link>
      </div>
    );
  }

  if (error && !offer) {
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

  if (!offer) return null;

  const isActive = offer.status === 'SENT' && !offer.expired;

  return (
    <>
      <StatusBanner offer={offer} onExpired={() => void load()} />

      <Link
        href="/careers/candidate/offers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to my offers
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT — summary card */}
        <aside className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900">
              Offer Summary
            </h2>

            <div className="my-4 h-px bg-gray-100" />

            <FieldGroup label="Position">
              <div className="text-base font-medium text-gray-900">
                {offer.jobPostingTitle ?? '—'}
              </div>
            </FieldGroup>

            {offer.entityName && (
              <FieldGroup label="Company">
                <div className="text-sm text-gray-700">{offer.entityName}</div>
              </FieldGroup>
            )}

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
              <FieldGroup label="Expected end date">
                <div className="text-sm text-gray-700">
                  {formatDateOnly(offer.expectedEndDate)}
                </div>
              </FieldGroup>
            )}

            <FieldGroup label="Status">
              <OfferStatusBadge status={offer.status} size="md" />
            </FieldGroup>

            {isActive && (
              <div className="mt-4">
                <OfferCountdown
                  expiresAt={offer.expiresAt}
                  variant="large"
                  onExpired={() => void load()}
                />
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT — letter + actions */}
        <div className="lg:col-span-2">
          {/* Letter */}
          <section className="rounded-lg border border-gray-200 bg-white p-8">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <h3 className="text-base font-semibold text-gray-900">
                Your Offer Letter
              </h3>
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

          {/* Action card — only render when offer is actionable */}
          {isActive && (
            <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-base font-semibold text-gray-900">
                Respond to this offer
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Once you accept or decline, your decision is final and cannot be
                undone.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setDeclineOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 sm:w-auto"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                  Decline Offer
                </button>
                <button
                  type="button"
                  onClick={() => setAcceptOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark sm:w-auto"
                >
                  <Check className="h-4 w-4" strokeWidth={2} />
                  Accept Offer
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        onConfirm={handleAccept}
        title="Accept this offer?"
        description={`By accepting, you commit to joining ${
          offer.entityName ?? 'the hiring team'
        } as a ${offer.jobPostingTitle ?? 'team member'} starting ${formatDateOnly(
          offer.startDate
        )}. Your decision is final.`}
        confirmLabel="Yes, Accept Offer"
        cancelLabel="Not Yet"
        variant="primary"
      />

      <DeclineOfferDialog
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        onConfirmed={() => void load()}
        offerId={offer.id}
      />
    </>
  );
}

function StatusBanner({
  offer,
  onExpired,
}: {
  offer: CandidateOfferResponse;
  onExpired: () => void;
}) {
  const isActive = offer.status === 'SENT' && !offer.expired;

  const base =
    '-mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-6 px-4 md:px-8 py-4 border-b flex items-center justify-between gap-4 flex-wrap';

  if (isActive) {
    return (
      <div className={base + ' bg-blue-50 border-blue-200 text-blue-900'}>
        <div className="flex items-center gap-2 text-base font-medium">
          <Sparkles className="h-5 w-5" strokeWidth={2} />
          An offer has been extended to you
        </div>
        <OfferCountdown
          expiresAt={offer.expiresAt}
          variant="large"
          onExpired={onExpired}
        />
      </div>
    );
  }
  if (offer.status === 'ACCEPTED') {
    return (
      <div className={base + ' bg-green-50 border-green-200 text-green-900'}>
        <div className="flex items-center gap-2 text-base font-medium">
          <CheckCircle className="h-5 w-5" strokeWidth={2} />
          🎉 You&apos;ve accepted this offer! HR will be in touch with next steps.
        </div>
      </div>
    );
  }
  if (offer.status === 'DECLINED') {
    return (
      <div className={base + ' bg-gray-50 border-gray-200 text-gray-700'}>
        <div className="flex items-center gap-2 text-base font-medium">
          <X className="h-5 w-5" strokeWidth={2} />
          You declined this offer on {formatFull(offer.respondedAt)}
        </div>
      </div>
    );
  }
  if (offer.status === 'EXPIRED' || (offer.status === 'SENT' && offer.expired)) {
    return (
      <div className={base + ' bg-amber-50 border-amber-200 text-amber-900'}>
        <div className="flex items-center gap-2 text-base font-medium">
          <Clock className="h-5 w-5" strokeWidth={2} />
          This offer expired on {formatFull(offer.expiresAt)}
        </div>
      </div>
    );
  }
  if (offer.status === 'REVOKED') {
    return (
      <div className={base + ' bg-red-50 border-red-200 text-red-900'}>
        <div className="flex items-center gap-2 text-base font-medium">
          <Ban className="h-5 w-5" strokeWidth={2} />
          This offer was withdrawn by the hiring team
        </div>
      </div>
    );
  }
  return null;
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

function LetterPreview({ content }: { content: string }) {
  const paragraphs = useMemo(() => (content ?? '').split(/\n\n+/), [content]);
  return (
    <article className="mx-auto max-w-prose space-y-4 font-serif text-sm leading-relaxed text-gray-800">
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

function DetailSkeleton() {
  return (
    <>
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-6 h-16 animate-pulse bg-gray-100" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-8">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-10/12 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </>
  );
}
