'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';

interface CreateRequest {
  applicationId: string;
  roleTitle: string;
  technology: string;
  tentativeStartDate: string;
  compensationSummary: string;
  worksite: string;
  expectedHoursPerWeek: number;
  expiryDays: number;
  contingencies: string;
}

// useSearchParams is unsafe outside <Suspense> during static prerendering.
// Wrap the inner reader so Next 14 build doesn't bail.
export default function CreateOfferPage() {
  return (
    <Suspense fallback={null}>
      <CreateOfferPageInner />
    </Suspense>
  );
}

function CreateOfferPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const applicationId = sp?.get('applicationId') ?? '';

  const [roleTitle, setRoleTitle] = useState('');
  const [technology, setTechnology] = useState('');
  const [tentativeStartDate, setTentativeStartDate] = useState('');
  const [compensationSummary, setCompensationSummary] = useState('');
  const [worksite, setWorksite] = useState('Remote');
  const [expectedHoursPerWeek, setExpectedHoursPerWeek] = useState<number>(20);
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [contingencies, setContingencies] = useState(
    'Subject to satisfactory background check and verification of work authorization.',
  );
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const renderPreview = useCallback(async () => {
    if (!applicationId) return;
    try {
      const body: CreateRequest = {
        applicationId,
        roleTitle,
        technology,
        tentativeStartDate,
        compensationSummary,
        worksite,
        expectedHoursPerWeek,
        expiryDays,
        contingencies,
      };
      const res = await api.post<{ subject: string; body: string }>(
        '/api/v1/erm/offers/preview',
        body,
      );
      setPreview(res.data);
    } catch {
      setPreview(null);
    }
  }, [
    applicationId,
    roleTitle,
    technology,
    tentativeStartDate,
    compensationSummary,
    worksite,
    expectedHoursPerWeek,
    expiryDays,
    contingencies,
  ]);

  useEffect(() => {
    const t = setTimeout(() => { void renderPreview(); }, 500);
    return () => clearTimeout(t);
  }, [renderPreview]);

  async function submit() {
    setErr(null);
    if (!applicationId) { setErr('applicationId is required.'); return; }
    if (!roleTitle.trim() || !tentativeStartDate || !compensationSummary.trim()) {
      setErr('Role title, start date, and compensation are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ id: string }>(
        '/api/v1/erm/offers',
        {
          applicationId,
          roleTitle: roleTitle.trim(),
          technology: technology.trim() || null,
          tentativeStartDate,
          compensationSummary: compensationSummary.trim(),
          worksite: worksite.trim(),
          expectedHoursPerWeek,
          expiryDays,
          contingencies: contingencies.trim() || null,
        },
      );
      router.push(`/careers/erm/offers/${res.data.id}`);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string; code?: string } } };
      setErr(
        ax.response?.data?.error ??
          (e instanceof Error ? e.message : 'Failed to create offer'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="Create Offer"
          subtitle={applicationId
            ? `Application: ${applicationId}`
            : 'Open from an Application detail with SELECTED interview decision.'}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            {!applicationId && (
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Open this page from the Application detail "Send offer" CTA so the
                applicationId is attached. Without it, create will fail.
              </p>
            )}
            <div className="space-y-3">
              <Field label="Role title" value={roleTitle} onChange={setRoleTitle} required />
              <Field label="Technology" value={technology} onChange={setTechnology} />
              <div className="grid grid-cols-2 gap-2">
                <DateField label="Tentative start date" value={tentativeStartDate}
                  onChange={setTentativeStartDate} required />
                <NumField label="Expiry (days)" value={expiryDays}
                  onChange={setExpiryDays} min={1} max={30} />
              </div>
              <Field label="Compensation summary" value={compensationSummary}
                onChange={setCompensationSummary} required maxLength={500} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Worksite" value={worksite} onChange={setWorksite} required maxLength={200} />
                <NumField label="Hours / week" value={expectedHoursPerWeek}
                  onChange={setExpectedHoursPerWeek} min={1} max={40} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-800">Contingencies</label>
                <textarea
                  value={contingencies}
                  onChange={(e) => setContingencies(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              {err && (
                <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {err}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Submit & send via DocuSign'}
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Email preview to applicant
            </p>
            {preview ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{preview.subject}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{preview.body}</p>
                <p className="mt-4 text-[11px] text-slate-400">Template: OFFER_LETTER</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Fill the form to see a live preview.
              </p>
            )}
          </aside>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Field({
  label, value, onChange, required, maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-800">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />
    </div>
  );
}

function DateField({
  label, value, onChange, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-800">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />
    </div>
  );
}

function NumField({
  label, value, onChange, min, max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-800">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />
    </div>
  );
}
