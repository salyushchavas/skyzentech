'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import OnboardingProgressBar from '@/components/onboarding/OnboardingProgressBar';
import OnboardingCategorySection from '@/components/onboarding/OnboardingCategorySection';
import { formatDueDate } from '@/lib/format-date';
import type {
  OnboardingCategory,
  OnboardingSummaryResponse,
  OnboardingTaskResponse,
} from '@/types';

const CATEGORY_ORDER: OnboardingCategory[] = [
  'PAPERWORK',
  'COMPLIANCE',
  'SETUP',
  'INTRODUCTION',
];

export default function CandidateOnboardingPage() {
  return (
    <ProtectedRoute requiredRoles={['APPLICANT', 'INTERN']}>
      <DashboardLayout title="Onboarding">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [tasks, setTasks] = useState<OnboardingTaskResponse[] | null>(null);
  const [summary, setSummary] = useState<OnboardingSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tRes, sRes] = await Promise.all([
        api.get<OnboardingTaskResponse[]>('/api/v1/onboarding/me'),
        api.get<OnboardingSummaryResponse>('/api/v1/onboarding/me/summary'),
      ]);
      setTasks(tRes.data ?? []);
      setSummary(sRes.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your onboarding.");
      setTasks(null);
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep summary in sync with optimistic task updates so the progress bar
  // and "next up" block move immediately after a toggle.
  useEffect(() => {
    if (!tasks) return;
    setSummary(recomputeSummary(tasks));
  }, [tasks]);

  const handleTaskUpdated = useCallback(
    (updated: OnboardingTaskResponse) => {
      setTasks((prev) =>
        prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev
      );
    },
    []
  );

  if (tasks === null && !error) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

  if (tasks && tasks.length === 0) return <EmptyState />;

  if (!tasks) return null;

  const tasksByCategory: Record<OnboardingCategory, OnboardingTaskResponse[]> = {
    PAPERWORK: [],
    COMPLIANCE: [],
    SETUP: [],
    INTRODUCTION: [],
  };
  for (const t of tasks) {
    if (tasksByCategory[t.category]) tasksByCategory[t.category].push(t);
  }
  for (const cat of CATEGORY_ORDER) {
    tasksByCategory[cat].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const allDone = summary !== null && summary.progressPercent >= 100;

  return (
    <>
      <ProgressCard summary={summary} allDone={allDone} />
      {CATEGORY_ORDER.map((cat) => (
        <OnboardingCategorySection
          key={cat}
          category={cat}
          tasks={tasksByCategory[cat]}
          onTaskUpdated={handleTaskUpdated}
        />
      ))}
    </>
  );
}

function ProgressCard({
  summary,
  allDone,
}: {
  summary: OnboardingSummaryResponse | null;
  allDone: boolean;
}) {
  if (!summary) return null;
  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          Onboarding Progress
        </h2>
        <span className="text-sm text-gray-600">
          {summary.completedTasks} of {summary.totalTasks} complete
        </span>
      </div>
      <OnboardingProgressBar value={summary.progressPercent} />

      {allDone ? (
        <div className="mt-4 text-sm text-green-700">
          🎉 Onboarding complete! Welcome to the team.
        </div>
      ) : summary.nextDueTask ? (
        <NextDueBlock task={summary.nextDueTask} />
      ) : null}
    </div>
  );
}

function NextDueBlock({ task }: { task: OnboardingTaskResponse }) {
  return (
    <div className="mt-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        Next up
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{task.title}</span>
        {task.dueDate && (
          <span
            className={
              'text-xs ' +
              (task.overdue ? 'font-medium text-red-700' : 'text-gray-500')
            }
          >
            {task.overdue
              ? `Overdue — was due ${formatDueDate(task.dueDate)}`
              : `Due ${formatDueDate(task.dueDate)}`}
          </span>
        )}
        {task.overdue && (
          <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            Overdue
          </span>
        )}
      </div>
    </div>
  );
}

function recomputeSummary(
  tasks: OnboardingTaskResponse[]
): OnboardingSummaryResponse {
  let completed = 0;
  let pending = 0;
  let inProgress = 0;
  let blocked = 0;
  let notApplicable = 0;
  for (const t of tasks) {
    switch (t.status) {
      case 'COMPLETED':
        completed++;
        break;
      case 'PENDING':
        pending++;
        break;
      case 'IN_PROGRESS':
        inProgress++;
        break;
      case 'BLOCKED':
        blocked++;
        break;
      case 'NOT_APPLICABLE':
        notApplicable++;
        break;
    }
  }
  const denom = tasks.length - notApplicable;
  const progressPercent =
    denom > 0 ? Math.round((completed * 100) / denom) : 0;

  // Next due = pending/in-progress with earliest dueDate
  const nextDueTask = tasks
    .filter(
      (t) =>
        (t.status === 'PENDING' || t.status === 'IN_PROGRESS') && t.dueDate
    )
    .sort((a, b) =>
      (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
    )[0] ?? null;

  return {
    totalTasks: tasks.length,
    completedTasks: completed,
    pendingTasks: pending,
    inProgressTasks: inProgress,
    blockedTasks: blocked,
    progressPercent,
    nextDueTask,
  };
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <ListChecks
        className="mx-auto h-16 w-16 text-gray-300"
        strokeWidth={1.5}
      />
      <h2 className="mt-4 text-xl font-semibold text-gray-900">
        Onboarding hasn&apos;t started yet
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        Your onboarding checklist will appear once you accept an offer.
      </p>
      <Link
        href="/careers/candidate/offers"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-accent-dark px-5 py-2.5 text-sm font-semibold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg"
      >
        View my offers
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <div className="mb-6 space-y-3 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex justify-between">
          <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="h-3 w-full animate-pulse rounded-full bg-gray-200" />
        <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="mt-8 first:mt-0">
          <div className="mb-3 h-5 w-40 animate-pulse rounded bg-gray-200" />
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-5"
              >
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
