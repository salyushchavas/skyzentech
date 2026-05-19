'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileBadge } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import I983StatusBadge from '@/components/i983/I983StatusBadge';
import CompensationDisplay from '@/components/offers/CompensationDisplay';
import { formatDateOnly } from '@/lib/format-date';
import type { I983PlanResponse } from '@/types';

export default function CandidateTrainingPlansPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="Training Plan">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const router = useRouter();
  const [plans, setPlans] = useState<I983PlanResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<I983PlanResponse[]>('/api/v1/i983/me');
      setPlans(res.data ?? []);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ?? "Couldn't load your training plan."
      );
      setPlans(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (plans === null && !error) return <LoadingSkeleton />;

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

  if (plans && plans.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <FileBadge
          className="mx-auto h-16 w-16 text-gray-300"
          strokeWidth={1.5}
        />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">
          No training plan yet
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Your I-983 STEM OPT Training Plan will appear here once your ERM
          prepares it. This usually happens shortly after you accept your offer.
        </p>
        <Link
          href="/careers/candidate/onboarding"
          className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          View onboarding checklist
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {plans!.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => router.push(`/careers/candidate/training-plans/${p.id}`)}
          className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-6 text-left transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {p.jobTitle ?? '(no job title yet)'}
              </div>
              {p.entityName && (
                <div className="text-sm text-gray-500">{p.entityName}</div>
              )}
            </div>
            <I983StatusBadge status={p.status} size="md" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
            {p.trainingStartDate && p.trainingEndDate && (
              <span>
                {formatDateOnly(p.trainingStartDate)} →{' '}
                {formatDateOnly(p.trainingEndDate)}
              </span>
            )}
            {p.hoursPerWeek != null && (
              <>
                <span className="text-gray-300">·</span>
                <span>{p.hoursPerWeek} hours/week</span>
              </>
            )}
            {p.compensationAmount != null && p.compensationFrequency && (
              <>
                <span className="text-gray-300">·</span>
                <CompensationDisplay
                  amount={p.compensationAmount}
                  frequency={p.compensationFrequency}
                  currency={p.compensationCurrency ?? 'USD'}
                />
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span>
              Employer:{' '}
              {p.employerSignedAt ? (
                <span className="text-green-700">✓ Signed</span>
              ) : (
                <span className="text-gray-400">⏳ Pending</span>
              )}
            </span>
            <span>
              Student:{' '}
              {p.studentSignedAt ? (
                <span className="text-green-700">✓ Signed</span>
              ) : (
                <span className="text-gray-400">⏳ Pending</span>
              )}
            </span>
          </div>

          <div className="mt-4">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
              View / Sign →
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl space-y-4">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-6"
        >
          <div className="flex justify-between">
            <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200" />
          </div>
          <div className="h-3 w-56 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
