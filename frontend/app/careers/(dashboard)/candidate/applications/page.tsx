'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ApplicationStatusBadge from '@/components/ApplicationStatusBadge';
import type { ApplicationResponse } from '@/types';

export default function CandidateApplicationsPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="My Applications">
        <Suspense fallback={<Spinner />}>
          <ApplicationsList />
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

function ApplicationsList() {
  const search = useSearchParams();
  const justApplied = search.get('just_applied') === '1';

  const [apps, setApps] = useState<ApplicationResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ApplicationResponse[]>('/api/v1/applications/me');
      setApps(res.data ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Couldn't load your applications.";
      setError(msg);
      setApps(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (apps === null && !error) return <Spinner />;

  return (
    <section>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">My Applications</h1>
      <p className="mb-6 text-sm text-slate-600">
        Track the status of your active applications.
      </p>

      {justApplied && (
        <div className="mb-6 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Application submitted! We&apos;ll review and get back to you.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {apps && apps.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="mb-4 text-base font-medium text-slate-700">
            You haven&apos;t applied to anything yet.
          </p>
          <Link
            href="/careers/openings"
            className="inline-block rounded-full bg-gradient-to-r from-accent to-accent-dark px-5 py-2.5 text-sm font-semibold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg"
          >
            Browse open internships
          </Link>
        </div>
      )}

      {apps && apps.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Applied</th>
                  <th className="px-4 py-3">Resume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apps.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/careers/openings/${a.jobPostingId}`}
                        className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
                      >
                        {a.jobPostingTitle ?? '(untitled)'}
                      </Link>
                      {a.recruiterNotes && (
                        <p className="mt-1 italic text-xs text-slate-500">
                          Note: {a.recruiterNotes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ApplicationStatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(a.appliedAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{a.resumeFileName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {apps.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <Link
                  href={`/careers/openings/${a.jobPostingId}`}
                  className="block font-medium text-primary-700 hover:text-primary-800"
                >
                  {a.jobPostingTitle ?? '(untitled)'}
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ApplicationStatusBadge status={a.status} />
                  <span className="text-xs text-slate-500">{formatDate(a.appliedAt)}</span>
                </div>
                {a.resumeFileName && (
                  <p className="mt-2 text-xs text-slate-600">Resume: {a.resumeFileName}</p>
                )}
                {a.recruiterNotes && (
                  <p className="mt-2 italic text-xs text-slate-500">
                    Note: {a.recruiterNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
