'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import type { Uuid } from '@/types';

interface InternSummaryResponse {
  candidateId: Uuid;
  name: string | null;
  email: string | null;
  position: string | null;
  entityName: string | null;
  hiredDate: string | null;
  assignedEvaluatorName: string | null;
}

export default function SupervisedInternDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'TECHNICAL_EVALUATOR', 'HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="Supervised Intern">
        <InternDetailStub />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function InternDetailStub() {
  const params = useParams<{ candidateId: string }>();
  const candidateId = params?.candidateId;

  const [intern, setIntern] = useState<InternSummaryResponse | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!candidateId) return;
    try {
      // No single-intern endpoint yet (lands in C2). For now resolve from the
      // roster the user already has access to so the stub shows the right name.
      const res = await api.get<InternSummaryResponse[]>('/api/v1/supervised/interns');
      const found = (res.data ?? []).find((i) => i.candidateId === candidateId) ?? null;
      setIntern(found);
      setNotFound(!found);
    } catch {
      setNotFound(true);
    }
  }, [candidateId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <Link
        href="/careers/supervised"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Supervised Interns
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          {intern?.name ?? (notFound ? 'Intern not found' : 'Loading…')}
        </h1>
        {intern?.position ? (
          <p className="mt-1 text-sm text-slate-600">
            {intern.position}
            {intern.entityName ? <> · {intern.entityName}</> : null}
          </p>
        ) : null}
      </header>

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
        Assignments, timesheets, and evaluations coming next.
      </div>
    </section>
  );
}
