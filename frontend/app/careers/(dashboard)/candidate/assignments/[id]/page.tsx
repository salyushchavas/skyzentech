'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly } from '@/lib/format-date';
import type { Uuid } from '@/types';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
type AssignmentStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'TECH_APPROVED'
  | 'PENDING_VIVA'
  | 'COMPLETED';

interface AssignmentDetail {
  id: Uuid;
  project: {
    id: Uuid;
    name: string;
    techStack?: string;
    difficulty?: Difficulty;
    description?: string;
    deliverables?: string;
    instructions?: string;
    expectedDurationDays?: number;
    startDate?: string;
    endDate?: string;
  };
  intern: { id: Uuid; fullName: string; email: string };
  assignedBy: { id: Uuid; fullName: string };
  assignmentDate: string;
  dueDate?: string;
  notes?: string;
  status: AssignmentStatus;
  createdAt?: string;
}

const DIFFICULTY_PILL: Record<Difficulty, string> = {
  EASY: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-sky-100 text-sky-800',
  HARD: 'bg-amber-100 text-amber-800',
  EXPERT: 'bg-rose-100 text-rose-800',
};

const STATUS_PILL: Record<AssignmentStatus, string> = {
  ASSIGNED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-sky-100 text-sky-800',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  RETURNED: 'bg-orange-100 text-orange-800',
  TECH_APPROVED: 'bg-violet-100 text-violet-800',
  PENDING_VIVA: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
};

export default function AssignmentDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['INTERN', 'APPLICANT']}>
      <DashboardLayout title="Assignment">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as Uuid | undefined;
  const [a, setA] = useState<AssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await api.get<AssignmentDetail>(
        `/api/v1/project-assignments/${id}`,
      );
      setA(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the assignment.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!a) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-1/3 animate-pulse rounded bg-gray-100" />
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header>
        <button
          type="button"
          onClick={() => router.push('/careers/candidate/assignments')}
          className="mb-1 text-xs text-gray-500 hover:text-gray-700"
        >
          ← Back to assignments
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">{a.project.name}</h1>
          {a.project.difficulty && (
            <span
              className={
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
                + DIFFICULTY_PILL[a.project.difficulty]
              }
            >
              {a.project.difficulty}
            </span>
          )}
          <span
            className={
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
              + STATUS_PILL[a.status]
            }
          >
            {a.status.replaceAll('_', ' ')}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          assigned by {a.assignedBy.fullName}
          <> · {formatDateOnly(a.assignmentDate)}</>
          {a.dueDate && <> · due {formatDateOnly(a.dueDate)}</>}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 lg:grid-cols-2">
        {a.project.techStack && (
          <Field label="Tech stack">
            <div className="flex flex-wrap gap-1">
              {a.project.techStack
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700"
                  >
                    {t}
                  </span>
                ))}
            </div>
          </Field>
        )}
        {a.project.expectedDurationDays != null && (
          <Field label="Expected duration">
            {a.project.expectedDurationDays} days
          </Field>
        )}
        {a.project.startDate && (
          <Field label="Project start">{formatDateOnly(a.project.startDate)}</Field>
        )}
        {a.project.endDate && (
          <Field label="Project end">{formatDateOnly(a.project.endDate)}</Field>
        )}
        {a.project.description && (
          <div className="lg:col-span-2">
            <Field label="Description">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {a.project.description}
              </p>
            </Field>
          </div>
        )}
        {a.project.deliverables && (
          <div className="lg:col-span-2">
            <Field label="Deliverables">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {a.project.deliverables}
              </p>
            </Field>
          </div>
        )}
        {a.project.instructions && (
          <div className="lg:col-span-2">
            <Field label="Instructions">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {a.project.instructions}
              </p>
            </Field>
          </div>
        )}
        {a.notes && (
          <div className="lg:col-span-2">
            <Field label="Notes from your evaluator">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {a.notes}
              </p>
            </Field>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}
