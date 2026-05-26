'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly } from '@/lib/format-date';
import type { WeeklyMaterialResponse } from '@/types';

/**
 * GAP C1 + D4 — intern view of released weekly training materials.
 * Backed by GET /api/v1/weekly-materials/me. Backend enforces the
 * active-intern + scoped-engagement visibility gate.
 */
export default function CandidateWeeklyMaterialsPage() {
  return (
    <ProtectedRoute requiredRoles={['APPLICANT', 'INTERN']}>
      <DashboardLayout title="Weekly Materials">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [materials, setMaterials] = useState<WeeklyMaterialResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Backend may return 403 when the candidate has no ACTIVE engagement —
  // render a soft "available when your internship starts" state in that case.
  const [needsActiveEngagement, setNeedsActiveEngagement] = useState(false);
  const [busyAckId, setBusyAckId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setNeedsActiveEngagement(false);
    try {
      const res = await api.get<WeeklyMaterialResponse[]>('/api/v1/weekly-materials/me');
      setMaterials(res.data ?? []);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setNeedsActiveEngagement(true);
        setMaterials(null);
        return;
      }
      setError(err?.response?.data?.error ?? "Couldn't load weekly materials.");
      setMaterials(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function acknowledge(materialId: string) {
    setBusyAckId(materialId);
    try {
      await api.post(`/api/v1/weekly-materials/${materialId}/acknowledge`);
      // Reload — backend now reports acknowledged=true for this row.
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not record acknowledgement.');
    } finally {
      setBusyAckId(null);
    }
  }

  if (needsActiveEngagement) return <NotActiveYetPanel />;
  if (materials === null && !error) return <LoadingSkeleton />;

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

  if (!materials || materials.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <BookOpen className="mx-auto h-16 w-16 text-gray-300" strokeWidth={1.5} />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">
          No weekly materials yet
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Your supervisor hasn&apos;t released this week&apos;s training material
          yet. Check back soon — releases appear here as they go out.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {materials.map((m) => (
        <article
          key={m.id}
          className="rounded-lg border border-gray-200 bg-white p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Week {m.weekNo}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                {m.title}
              </h2>
              {m.publishedByName && (
                <p className="mt-1 text-xs text-gray-500">
                  Published by {m.publishedByName}
                  {m.releaseDate && ` · ${formatDateOnly(m.releaseDate)}`}
                </p>
              )}
            </div>
            {m.acknowledged ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Acknowledged
              </span>
            ) : (
              m.dueDate && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                  <Clock className="h-3.5 w-3.5" />
                  Due {formatDateOnly(m.dueDate)}
                </span>
              )
            )}
          </div>

          {m.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {m.description}
            </p>
          )}

          {m.resourceUrls.length > 0 && (
            <ul className="mt-4 space-y-1">
              {m.resourceUrls.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex items-center justify-between">
            {m.acknowledged && m.acknowledgedAt ? (
              <p className="text-xs text-gray-500">
                Acknowledged {formatDateOnly(m.acknowledgedAt)}
              </p>
            ) : (
              <span />
            )}
            {!m.acknowledged && (
              <button
                type="button"
                onClick={() => void acknowledge(m.id)}
                disabled={busyAckId === m.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-accent to-accent-dark px-4 py-2 text-sm font-medium text-white shadow-glow-accent hover:shadow-glow-accent-lg disabled:opacity-50 disabled:shadow-none"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busyAckId === m.id ? 'Recording…' : "Mark as reviewed"}
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function NotActiveYetPanel() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <BookOpen className="mx-auto h-16 w-16 text-gray-300" strokeWidth={1.5} />
      <h2 className="mt-4 text-xl font-semibold text-gray-900">
        Available once your internship is active
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        Weekly training materials unlock when your engagement reaches the
        ACTIVE phase. Check your onboarding checklist for what&apos;s still
        outstanding.
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

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl space-y-4">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-6"
        >
          <div className="flex justify-between">
            <div className="h-5 w-56 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200" />
          </div>
          <div className="h-3 w-72 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-36 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
