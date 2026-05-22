'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import I9StatusBanner from '@/components/i9/I9StatusBanner';
import Section1Form from '@/components/i9/Section1Form';
import Section1ReadOnlyView from '@/components/i9/Section1ReadOnlyView';
import Section2WaitingCard from '@/components/i9/Section2WaitingCard';
import Section2CompletedCard from '@/components/i9/Section2CompletedCard';
import type { I9FormResponse } from '@/types';

export default function CandidateI9Page() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="Form I-9">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [form, setForm] = useState<I9FormResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<I9FormResponse>('/api/v1/i9/me');
      setForm(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your I-9.");
      setForm(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (form === null && !error) return <LoadingSkeleton />;

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

  if (!form) return null;

  const isEditable =
    form.status === 'NOT_STARTED' || form.status === 'REOPENED';
  // Phase 3 step 5 — SECTION_2_PENDING is the canonical "Section 1 done"
  // state; SECTION_1_COMPLETE is the legacy alias kept for old rows.
  const isSection1Done =
    form.status === 'SECTION_2_PENDING' || form.status === 'SECTION_1_COMPLETE';
  const isCompleted = form.status === 'COMPLETED';

  return (
    <>
      <I9StatusBanner form={form} />

      {isEditable && <Section1Form form={form} onSaved={setForm} />}

      {(isSection1Done || isCompleted) && (
        <>
          <Section1ReadOnlyView form={form} />
          <div className="mt-8">
            {isSection1Done && <Section2WaitingCard form={form} />}
            {isCompleted && <Section2CompletedCard form={form} />}
          </div>
        </>
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-8 h-20 animate-pulse bg-gray-100" />
      <div className="max-w-2xl space-y-6">
        <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
          <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
        </div>
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
          <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    </>
  );
}
