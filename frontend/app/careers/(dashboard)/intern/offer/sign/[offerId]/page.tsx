'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import InternPageShell from '@/components/intern/InternPageShell';

type OfferStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'EXPIRED' | 'VOIDED' | 'DECLINED';

interface ApplicantOfferView {
  offerId: string;
  status: OfferStatus;
  applicantFullName: string | null;
  applicantId: string | null;
  applicantEmail: string | null;
  roleTitle: string | null;
  jobTitle: string | null;
  compensationSummary: string | null;
  worksite: string | null;
  expectedHoursPerWeek: number | null;
  tentativeStartDate: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  signedAt: string | null;
  signedByTypedName: string | null;
  letterContent: string | null;
  contingencies: string | null;
}

export default function InternOfferSignPage() {
  const params = useParams<{ offerId: string }>();
  const router = useRouter();
  const offerId = params?.offerId ?? '';

  const [offer, setOffer] = useState<ApplicantOfferView | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!offerId) return;
    setLoading(true);
    try {
      const res = await api.get<ApplicantOfferView>(
        `/api/v1/applicant/offers/${offerId}`,
      );
      setOffer(res.data);
      setErr(null);
    } catch (e) {
      const ax = e as { response?: { status?: number; data?: { error?: string } } };
      if (ax.response?.status === 403) {
        router.replace('/careers/intern?toast=offer-not-found');
        return;
      }
      setErr(ax.response?.data?.error ?? (e instanceof Error ? e.message : 'Failed to load offer'));
    } finally {
      setLoading(false);
    }
  }, [offerId, router]);

  useEffect(() => { void load(); }, [load]);

  const canSubmit = typedName.trim().length > 0 && agreed && !submitting;

  async function submit() {
    if (!canSubmit || !offer) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      await api.post(`/api/v1/applicant/offers/${offer.offerId}/sign`, {
        typedName: typedName.trim(),
      });
      router.replace('/careers/intern?toast=offer-signed');
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setSubmitErr(ax.response?.data?.error ?? (e instanceof Error ? e.message : 'Sign failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const expired = useMemo(() => {
    if (!offer?.expiresAt) return false;
    return new Date(offer.expiresAt).getTime() < Date.now();
  }, [offer]);

  return (
    <ProtectedRoute requiredRoles={['INTERN']}>
      <InternPageShell title="Offer of Internship" subtitle="Review and sign below.">
        {loading ? (
          <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
        ) : err ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {err}
          </p>
        ) : !offer ? (
          <p className="text-sm text-slate-500">Offer not found.</p>
        ) : (
          <div className="space-y-6">
            {/* Status banners */}
            {offer.status === 'SIGNED' && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold">
                    You signed this offer
                    {offer.signedAt ? ` on ${new Date(offer.signedAt).toLocaleString()}` : ''}.
                  </p>
                  <p className="mt-1 text-xs">
                    Welcome to Skyzen Tech!
                    {offer.signedByTypedName && ` Signed as ${offer.signedByTypedName}.`}
                  </p>
                </div>
              </div>
            )}
            {(offer.status === 'EXPIRED' || (offer.status === 'SENT' && expired)) && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div>
                  <p className="font-semibold">
                    This offer expired
                    {offer.expiresAt ? ` on ${new Date(offer.expiresAt).toLocaleDateString()}` : ''}.
                  </p>
                  <p className="mt-1 text-xs">Please contact ERM to discuss next steps.</p>
                </div>
              </div>
            )}
            {(offer.status === 'VOIDED' || offer.status === 'DECLINED') && (
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div>
                  <p className="font-semibold">
                    This offer is no longer active (status: {offer.status}).
                  </p>
                  <p className="mt-1 text-xs">Please contact ERM if you have questions.</p>
                </div>
              </div>
            )}

            {/* Offer letter body */}
            <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <header className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="h-5 w-5 text-teal-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  Skyzen Tech — Offer Letter
                </h2>
              </header>

              {offer.letterContent ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-800">
                  {offer.letterContent}
                </pre>
              ) : (
                <DefaultLetter offer={offer} />
              )}
            </article>

            {/* Signing block — only when actionable */}
            {offer.status === 'SENT' && !expired && (
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Sign this offer</h3>
                <p className="mt-1 text-xs text-slate-500">
                  By typing your full name below and clicking <strong>Sign Offer</strong>, you
                  indicate your acceptance of this offer and your intent to be electronically
                  bound by its terms.
                </p>

                <label className="mt-4 block">
                  <span className="text-sm font-medium text-slate-800">
                    Type your full name to sign
                  </span>
                  <input
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder={offer.applicantFullName ?? 'Your full name'}
                    maxLength={200}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </label>

                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Your signature preview
                  </p>
                  <p
                    className="mt-2 text-3xl text-slate-900"
                    style={{
                      fontFamily: 'var(--font-dancing-script), "Brush Script MT", cursive',
                      minHeight: '2.5rem',
                    }}
                  >
                    {typedName || <span className="text-slate-300">—</span>}
                  </p>
                </div>

                <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>I have read and agree to the terms of this offer.</span>
                </label>

                {submitErr && (
                  <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                    {submitErr}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500">
                    {typedName.trim().length === 0
                      ? 'Type your name to enable Sign Offer.'
                      : !agreed
                        ? 'Tick the agreement to enable Sign Offer.'
                        : 'Ready to sign.'}
                  </p>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? 'Signing…' : 'Sign Offer'}
                  </button>
                </div>
              </section>
            )}

            <footer className="text-center text-xs text-slate-500">
              Need help? Contact your ERM at{' '}
              <a className="text-teal-700 hover:underline" href="mailto:erm@skyzentech.com">
                erm@skyzentech.com
              </a>
              .{' '}
              <Link href="/careers/intern" className="text-teal-700 hover:underline">
                Back to dashboard
              </Link>
            </footer>
          </div>
        )}
      </InternPageShell>
    </ProtectedRoute>
  );
}

function DefaultLetter({ offer }: { offer: ApplicantOfferView }) {
  const fieldRows: Array<[string, string | null]> = [
    ['Role', offer.roleTitle ?? offer.jobTitle ?? '—'],
    ['Applicant ID', offer.applicantId ?? '—'],
    ['Compensation', offer.compensationSummary ?? '—'],
    ['Tentative start date', offer.tentativeStartDate ?? '—'],
    ['Worksite', offer.worksite ?? '—'],
    ['Expected hours', offer.expectedHoursPerWeek != null ? `${offer.expectedHoursPerWeek}/week` : '—'],
    ['Expires on', offer.expiresAt ? new Date(offer.expiresAt).toLocaleDateString() : '—'],
  ];
  return (
    <div className="space-y-4 text-sm leading-6 text-slate-800">
      <p>Hello {offer.applicantFullName ?? 'there'},</p>
      <p>Skyzen Tech is pleased to extend the following internship offer:</p>
      <dl className="grid grid-cols-[10rem_1fr] gap-y-1 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
        {fieldRows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-medium text-slate-600">{k}</dt>
            <dd className="text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      {offer.contingencies && (
        <p className="text-slate-700">{offer.contingencies}</p>
      )}
      <p>
        This offer expires on{' '}
        <strong>
          {offer.expiresAt ? new Date(offer.expiresAt).toLocaleDateString() : 'the date above'}
        </strong>
        . Please review and sign below before then.
      </p>
      <p>
        By typing your full name in the signing block below and clicking <em>Sign Offer</em>, you
        indicate your acceptance of this offer and your intent to be electronically bound by its
        terms.
      </p>
    </div>
  );
}
