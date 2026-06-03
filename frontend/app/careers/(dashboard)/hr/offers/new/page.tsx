'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { todayDateInput } from '@/lib/format-date';
import type {
  ApplicationResponse,
  ApplicationStatus,
  CompensationFrequency,
  CreateOfferRequest,
  OfferResponse,
  Page,
} from '@/types';

// GAP A3 — keep this aligned with the backend OFFER_ALLOWED_FROM set in
// OfferService.java. An interview decision is a prerequisite; pre-interview
// applications are hidden from the picker so the recruiter never sees a
// 403 INTERVIEW_REQUIRED after clicking "Create offer".
const ALLOWED_STATUSES: ReadonlyArray<ApplicationStatus> = [
  'INTERVIEWED',
  'SELECTED_CONDITIONAL',
  'OFFERED',
];

const FREQ_OPTIONS: { value: CompensationFrequency; label: string }[] = [
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

export default function NewOfferPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'HR']}>
      <DashboardLayout title="Create Offer">
        <Suspense fallback={<Spinner />}>
          <Form />
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

function Form() {
  const router = useRouter();
  const search = useSearchParams();
  const presetApplicationId = search.get('fromApplication') ?? '';

  const [apps, setApps] = useState<ApplicationResponse[] | null>(null);
  const [appsError, setAppsError] = useState<string | null>(null);

  const [applicationId, setApplicationId] = useState(presetApplicationId);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<CompensationFrequency>('MONTHLY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysToRespond, setDaysToRespond] = useState(7);
  const [additionalTerms, setAdditionalTerms] = useState('');

  const [submitting, setSubmitting] = useState<'draft' | 'send' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadApps = useCallback(async () => {
    setAppsError(null);
    try {
      const res = await api.get<Page<ApplicationResponse>>('/api/v1/applications', {
        params: { size: 100 },
      });
      const eligible = (res.data?.content ?? []).filter((a) =>
        ALLOWED_STATUSES.includes(a.status)
      );
      setApps(eligible);
    } catch (err: any) {
      setAppsError(err?.response?.data?.error ?? 'Could not load applications');
      setApps(null);
    }
  }, []);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const sortedApps = useMemo(() => {
    if (!apps) return [];
    return [...apps].sort((a, b) =>
      (a.candidateName ?? '').localeCompare(b.candidateName ?? '')
    );
  }, [apps]);

  const selectedApp = useMemo(
    () => sortedApps.find((a) => a.id === applicationId) ?? null,
    [sortedApps, applicationId]
  );

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!applicationId) errs.applicationId = 'Pick a candidate';
    const amountNum = Number(amount);
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      errs.amount = 'Enter a positive amount';
    }
    if (!startDate) errs.startDate = 'Pick a start date';
    else if (new Date(startDate) < new Date(todayDateInput())) {
      errs.startDate = 'Start date must be today or later';
    }
    if (endDate && new Date(endDate) <= new Date(startDate)) {
      errs.endDate = 'End date must be after the start date';
    }
    if (
      !Number.isInteger(daysToRespond) ||
      daysToRespond < 1 ||
      daysToRespond > 30
    ) {
      errs.daysToRespond = 'Pick a value between 1 and 30';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(sendImmediately: boolean, e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const body: CreateOfferRequest = {
      applicationId,
      compensationAmount: Number(amount),
      compensationFrequency: frequency,
      compensationCurrency: 'USD',
      startDate,
      expectedEndDate: endDate || undefined,
      daysToRespond,
      additionalTerms: additionalTerms.trim() || undefined,
    };

    setSubmitting(sendImmediately ? 'send' : 'draft');
    try {
      const res = await api.post<OfferResponse>('/api/v1/offers', body);
      const offerId = res.data.id;
      if (sendImmediately) {
        try {
          await api.post(`/api/v1/offers/${offerId}/send`);
          toast.success(
            `Offer sent to ${selectedApp?.candidateName ?? 'candidate'}`
          );
        } catch (sendErr: any) {
          toast.error(
            sendErr?.response?.data?.error ??
              'Draft saved but send failed — open the offer and try again'
          );
        }
      } else {
        toast.success('Draft saved');
      }
      router.push(`/careers/hr/offers/${offerId}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not create offer';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          {/* Candidate / application */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Candidate <span className="text-red-500">*</span>
            </label>
            {appsError && (
              <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {appsError}{' '}
                <button
                  type="button"
                  onClick={() => void loadApps()}
                  className="ml-1 font-medium underline"
                >
                  Retry
                </button>
              </div>
            )}
            <select
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              disabled={apps === null}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700 disabled:bg-gray-50"
            >
              <option value="">
                {apps === null
                  ? 'Loading applications…'
                  : sortedApps.length === 0
                    ? 'No eligible applications'
                    : 'Select an application…'}
              </option>
              {sortedApps.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.candidateName ?? '(unnamed)') +
                    ' — ' +
                    (a.jobPostingTitle ?? '(no posting)') +
                    ' (' +
                    a.status +
                    ')'}
                </option>
              ))}
            </select>
            {fieldErrors.applicationId && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.applicationId}</p>
            )}

            {selectedApp && (
              <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="font-medium text-gray-900">
                  {selectedApp.candidateName ?? '(unnamed)'}
                </div>
                {selectedApp.candidateEmail && (
                  <div className="text-xs text-gray-500">
                    {selectedApp.candidateEmail}
                  </div>
                )}
                <div className="mt-1.5 text-xs text-gray-700">
                  {selectedApp.jobPostingTitle ?? '—'}{' '}
                  <span className="text-gray-400">·</span>{' '}
                  <span className="font-medium text-gray-600">
                    {selectedApp.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Amount + frequency */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Compensation amount <span className="text-red-500">*</span>
            </label>
            <div className="flex overflow-hidden rounded-md border border-gray-300 focus-within:border-primary-700 focus-within:ring-1 focus-within:ring-primary-700">
              <span className="flex items-center bg-gray-50 px-3 py-2 text-sm text-gray-500">
                $
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2800.00"
                className="flex-1 border-l border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Numeric value only — currency symbol added automatically.
            </p>
            {fieldErrors.amount && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Frequency <span className="text-red-500">*</span>
            </label>
            <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
              {FREQ_OPTIONS.map((opt) => {
                const active = frequency === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFrequency(opt.value)}
                    className={
                      'rounded px-3 py-1 text-xs font-medium transition-colors ' +
                      (active
                        ? 'bg-accent text-white'
                        : 'text-gray-600 hover:bg-gray-100')
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Currency display */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Currency
            </label>
            <input
              value="USD"
              disabled
              className="w-32 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Multi-currency support coming soon.
            </p>
          </div>

          {/* Start date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Internship start date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              min={todayDateInput()}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
            />
            {fieldErrors.startDate && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.startDate}</p>
            )}
          </div>

          {/* End date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Expected end date (optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
            />
            <p className="mt-1 text-xs text-gray-500">
              For fixed-term internships (e.g. 12 weeks).
            </p>
            {fieldErrors.endDate && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.endDate}</p>
            )}
          </div>

          {/* Days to respond */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Days for candidate to respond <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={daysToRespond}
              onChange={(e) => setDaysToRespond(Number(e.target.value))}
              className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
            />
            <p className="mt-1 text-xs text-gray-500">
              Once sent, the candidate has this many days to accept or decline.
            </p>
            {fieldErrors.daysToRespond && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.daysToRespond}</p>
            )}
          </div>

          {/* Additional terms */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Additional terms
            </label>
            <textarea
              value={additionalTerms}
              onChange={(e) => setAdditionalTerms(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
            />
            <p className="mt-1 text-xs text-gray-500">
              Custom clauses appended to the standard offer letter.
            </p>
          </div>

          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting !== null}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => void submit(false, e)}
              disabled={submitting !== null}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {submitting === 'draft' ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={(e) => void submit(true, e)}
              disabled={submitting !== null}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
            >
              {submitting === 'send' ? 'Saving & Sending…' : 'Save & Send Immediately'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
