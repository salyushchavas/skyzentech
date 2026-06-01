'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/lib/api';
import type { Uuid } from '@/types';

interface EvaluatorInternResponse {
  candidateId: Uuid;
  name: string | null;
  position: string | null;
  entityName: string | null;
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function EvaluatorInternsPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'TECHNICAL_SUPERVISOR']}>
      <DashboardLayout title="Active Interns">
        <InternsList />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function InternsList() {
  const [interns, setInterns] = useState<EvaluatorInternResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<EvaluatorInternResponse[]>(
        '/api/v1/supervised/evaluator/interns',
      );
      setInterns(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your interns.");
      setInterns(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (interns === null) {
    return <div className="py-10 text-center text-sm text-gray-500">Loading…</div>;
  }

  if (interns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <Users className="mx-auto mb-3 h-8 w-8 text-gray-400" strokeWidth={1.5} />
        <p className="text-sm text-gray-600">No interns assigned to you yet.</p>
      </div>
    );
  }

  return (
    <section>
      <p className="mb-4 text-sm text-gray-600">
        {interns.length} intern{interns.length === 1 ? '' : 's'} assigned to you.
      </p>
      <ul className="space-y-3">
        {interns.map((i) => (
          <li
            key={i.candidateId}
            className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-5 hover:border-gray-300"
          >
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                {initialsOf(i.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-gray-900">{i.name ?? '—'}</div>
                <div className="truncate text-sm text-gray-600">
                  {i.position ?? '—'}
                  {i.entityName ? <> · {i.entityName}</> : null}
                </div>
              </div>
            </div>
            <Link
              href={`/careers/supervised/${i.candidateId}`}
              className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
