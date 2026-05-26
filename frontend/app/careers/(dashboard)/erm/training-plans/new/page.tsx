'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import type {
  ApplicationResponse,
  I983PlanResponse,
  Page,
} from '@/types';

export default function NewI983PlanPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'HR_COMPLIANCE']}>
      <DashboardLayout title="New Training Plan">
        <Form />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Form() {
  const router = useRouter();
  const [apps, setApps] = useState<ApplicationResponse[] | null>(null);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    setAppsError(null);
    try {
      const res = await api.get<Page<ApplicationResponse>>(
        '/api/v1/applications',
        { params: { size: 200 } }
      );
      // Candidates whose application is ACCEPTED — the real-enum equivalent of
      // the spec's "OFFER_ACCEPTED | HIRED".
      const eligible = (res.data?.content ?? []).filter(
        (a) => a.status === 'ACCEPTED'
      );
      setApps(eligible);
    } catch (err: any) {
      setAppsError(
        err?.response?.data?.error ?? "Couldn't load applications."
      );
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

  const selected = useMemo(
    () => sortedApps.find((a) => a.id === applicationId) ?? null,
    [sortedApps, applicationId]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selected) {
      setFormError('Pick a candidate to create the plan for.');
      return;
    }
    setSubmitting(true);
    try {
      // Backend derives candidateId from the application's FK.
      const res = await api.post<I983PlanResponse>('/api/v1/i983', {
        applicationId: selected.id,
      });
      toast.success('Plan created — fill in the remaining sections');
      router.push(`/careers/erm/training-plans/${res.data.id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Couldn't create plan.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Candidate <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-gray-500">
              Select a candidate who has accepted an offer. Their information
              will be auto-filled from the application and offer.
            </p>
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
                  ? 'Loading…'
                  : sortedApps.length === 0
                    ? 'No accepted applications'
                    : 'Select an application…'}
              </option>
              {sortedApps.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.candidateName ?? '(unnamed)') +
                    ' — ' +
                    (a.jobPostingTitle ?? '(no posting)')}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Auto-fill source
              </div>
              <div className="mt-1 font-medium text-gray-900">
                {selected.candidateName ?? '(unnamed)'}
              </div>
              {selected.candidateEmail && (
                <div className="text-xs text-gray-500">
                  {selected.candidateEmail}
                </div>
              )}
              <div className="mt-1.5 text-xs text-gray-700">
                {selected.jobPostingTitle ?? '—'}
                <span className="text-gray-400"> · </span>
                <span className="font-medium text-gray-600">
                  {selected.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                The plan will be created in DRAFT status. Job title, training
                dates, and compensation will be copied from the linked offer if
                one exists. ERM fills in the rest.
              </p>
            </div>
          )}

          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selected}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
