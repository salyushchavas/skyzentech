'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
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

interface AssignmentRow {
  id: Uuid;
  project: {
    id: Uuid;
    name: string;
    techStack?: string;
    difficulty?: Difficulty;
    description?: string;
  };
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

export default function MyAssignmentsPage() {
  return (
    <ProtectedRoute requiredRoles={['INTERN', 'APPLICANT']}>
      <DashboardLayout title="My Assignments">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<AssignmentRow[]>(
        '/api/v1/project-assignments/mine',
      );
      setRows(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your assignments.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">My Assignments</h1>
        <p className="mt-1 text-sm text-gray-600">
          Projects assigned to you by your Technical Evaluator.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {rows === null ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          You don&apos;t have any assignments yet. Your Technical Evaluator will
          assign you projects from the catalog.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <Link href={`/careers/candidate/assignments/${r.id}`} className="block">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 hover:text-accent-dark hover:underline">
                        {r.project.name}
                      </h3>
                      {r.project.difficulty && (
                        <span
                          className={
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
                            + DIFFICULTY_PILL[r.project.difficulty]
                          }
                        >
                          {r.project.difficulty}
                        </span>
                      )}
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
                          + STATUS_PILL[r.status]
                        }
                      >
                        {r.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    {r.project.techStack && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.project.techStack
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((t) => (
                            <span
                              key={t}
                              className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700"
                            >
                              {t}
                            </span>
                          ))}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-500">
                      assigned by {r.assignedBy.fullName}
                      <> · {formatDateOnly(r.assignmentDate)}</>
                      {r.dueDate && <> · due {formatDateOnly(r.dueDate)}</>}
                    </div>
                    {r.notes && (
                      <p className="mt-2 line-clamp-2 text-xs text-gray-700">
                        {r.notes}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
