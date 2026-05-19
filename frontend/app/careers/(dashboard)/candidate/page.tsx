'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import OnboardingProgressBar from '@/components/onboarding/OnboardingProgressBar';
import { useAuth } from '@/lib/auth-context';
import type { OnboardingSummaryResponse } from '@/types';

export default function CandidateDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="Dashboard">
        <CandidateDashboardBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function CandidateDashboardBody() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<OnboardingSummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<OnboardingSummaryResponse>(
          '/api/v1/onboarding/me/summary'
        );
        if (!cancelled) setSummary(res.data ?? null);
      } catch {
        if (!cancelled) setSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showOnboardingCard = summary != null && summary.totalTasks > 0;

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </h2>
      <p className="mb-6 text-sm text-gray-600">
        Track your applications, manage your resumes, and discover new internships.
      </p>

      {showOnboardingCard && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Your Onboarding Progress
            </h3>
            <span className="text-sm text-gray-600">
              {summary!.completedTasks} of {summary!.totalTasks} complete
            </span>
          </div>
          <OnboardingProgressBar value={summary!.progressPercent} />
          <div className="mt-4">
            <Link
              href="/careers/candidate/onboarding"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-dark"
            >
              Continue onboarding
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Browse open positions" body="Explore internships matched to your skills." />
        <Card title="My applications" body="Track the status of your active applications." />
      </div>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-2 font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}
