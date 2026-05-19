'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ConfirmDialog from '@/components/ConfirmDialog';
import I983StatusBadge from '@/components/i983/I983StatusBadge';
import I983ReadOnlyView from '@/components/i983/I983ReadOnlyView';
import { formatFull } from '@/lib/format-date';
import type {
  I983PlanResponse,
  OnboardingTaskResponse,
} from '@/types';

export default function CandidateTrainingPlanDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="Training Plan">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams();
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : null;

  const [plan, setPlan] = useState<I983PlanResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attested, setAttested] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setNotFound(false);
    try {
      const res = await api.get<I983PlanResponse>(`/api/v1/i983/${id}`);
      setPlan(res.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err?.response?.data?.error ?? "Couldn't load this plan.");
      }
      setPlan(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function autoMarkOnboardingTask() {
    try {
      const tasks = await api.get<OnboardingTaskResponse[]>(
        '/api/v1/onboarding/me'
      );
      const t = tasks.data?.find((task) => task.taskKey === 'I983_PLAN');
      if (t && t.status !== 'COMPLETED') {
        await api.patch(`/api/v1/onboarding/tasks/${t.id}`, {
          status: 'COMPLETED',
        });
      }
    } catch {
      // Silently ignore — onboarding sync is best-effort.
    }
  }

  async function handleSign() {
    if (!plan) return;
    try {
      const res = await api.post<I983PlanResponse>(
        `/api/v1/i983/${plan.id}/sign-student`
      );
      toast.success('Signed ✓');
      setPlan(res.data);
      setSignOpen(false);
      setAttested(false);
      void autoMarkOnboardingTask();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't sign.");
    }
  }

  if (plan === null && !error && !notFound) return <DetailSkeleton />;

  if (notFound) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="mb-4 text-base font-medium text-gray-700">
          Training plan not found.
        </p>
        <Link
          href="/careers/candidate/training-plans"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to my training plans
        </Link>
      </div>
    );
  }

  if (error && !plan) {
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

  if (!plan) return null;

  const employerSigned = Boolean(plan.employerSignedAt);
  const studentSigned = Boolean(plan.studentSignedAt);
  const isEditableStage =
    plan.status === 'DRAFT' || plan.status === 'AMENDMENT_REQUESTED';
  const canSignNow =
    isEditableStage && employerSigned && !studentSigned;

  return (
    <>
      <Link
        href="/careers/candidate/training-plans"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to my training plans
      </Link>

      {/* Header card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {plan.jobTitle ?? '(no job title yet)'}
            </h2>
            {plan.entityName && (
              <div className="text-sm text-gray-500">{plan.entityName}</div>
            )}
          </div>
          <I983StatusBadge status={plan.status} size="md" />
        </div>

        {plan.status === 'AMENDMENT_REQUESTED' && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              Your DSO requested changes. Your ERM is updating the plan. You&apos;ll
              be notified when it&apos;s ready to re-sign.
            </span>
          </div>
        )}
        {plan.status === 'DSO_APPROVED' && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              Your I-983 has been approved by your DSO. Your STEM OPT employment
              training is officially in place.
            </span>
          </div>
        )}
        {plan.status === 'DSO_REJECTED' && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              Your DSO rejected this plan. Your ERM will reach out about next
              steps.
            </span>
          </div>
        )}
      </div>

      {/* Body content depends on signature state */}
      {isEditableStage && !employerSigned && (
        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Your ERM is still preparing this plan. You&apos;ll be able to review
          and sign once they&apos;ve finalized it.
        </div>
      )}

      {canSignNow && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your ERM has signed. Please review and sign to complete your Training
          Plan.
        </div>
      )}

      <I983ReadOnlyView plan={plan} />

      {canSignNow && (
        <div className="mt-8 max-w-3xl rounded-lg bg-gray-50 p-6">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">
            Student Attestation
          </h3>
          <p className="text-sm text-gray-700">
            I attest that I have reviewed this Training Plan, agree to the
            training program described, and commit to completing the required
            reporting (including the 12-month and final evaluations).
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-accent"
            />
            <span className="text-sm text-gray-900">I attest as above</span>
          </label>
          <button
            type="button"
            onClick={() => setSignOpen(true)}
            disabled={!attested}
            className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
          >
            Sign Training Plan
          </button>
          <p className="mt-3 text-xs text-gray-500">
            Your full name and the current date and time will be recorded as
            your electronic signature.
          </p>
        </div>
      )}

      {studentSigned && (
        <p className="mt-6 text-sm italic text-gray-500">
          Your signature:{' '}
          <span className="font-medium text-gray-700">
            {plan.studentSignedName ?? '—'}
          </span>{' '}
          on {formatFull(plan.studentSignedAt)}
        </p>
      )}

      <ConfirmDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onConfirm={handleSign}
        title="Sign your Training Plan?"
        description="This electronically signs the I-983 on your behalf. The signature and timestamp are recorded permanently."
        confirmLabel="Sign"
        variant="primary"
      />
    </>
  );
}

function DetailSkeleton() {
  return (
    <>
      <div className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded bg-gray-100" />
        <div className="h-40 animate-pulse rounded bg-gray-100" />
      </div>
    </>
  );
}
