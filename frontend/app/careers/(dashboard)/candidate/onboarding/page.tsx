'use client';

import { CheckCircle2, Circle, Lock } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';

type Status = 'complete' | 'active' | 'locked';

interface Step {
  status: Status;
  title: string;
  description: string;
  completedDate?: string;
  cta?: string;
}

const STEPS: Step[] = [
  { status: 'complete', title: 'Sign offer letter', description: 'Reviewed and signed your offer letter', completedDate: 'May 10, 2026' },
  { status: 'complete', title: 'Submit Form I-9 (Section 1)', description: 'Provided identification documents', completedDate: 'May 11, 2026' },
  { status: 'complete', title: 'Background check', description: 'Cleared standard background verification', completedDate: 'May 14, 2026' },
  { status: 'active', title: 'Form I-983 Training Plan', description: 'Work with your ERM to complete your training plan', cta: 'Continue' },
  { status: 'active', title: 'Meet your team', description: 'Hierarchy intro session with your assigned Technical Evaluator', cta: 'Schedule' },
  { status: 'locked', title: 'GitLab access', description: 'Setup development environment and code access' },
  { status: 'locked', title: 'First-week orientation', description: 'Welcome session with HR and your evaluator' },
  { status: 'locked', title: 'Submit first weekly timesheet', description: 'Log your first week of work' },
];

export default function CandidateOnboardingPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="Onboarding">
        <PreviewShell>
          <Body />
        </PreviewShell>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const complete = STEPS.filter((s) => s.status === 'complete').length;
  const total = STEPS.length;
  const pct = Math.round((complete / total) * 100);

  return (
    <>
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Onboarding Progress: {complete} of {total} complete
          </h2>
          <span className="text-xs font-medium text-gray-500">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <ul className="space-y-3">
        {STEPS.map((s, i) => (
          <li
            key={i}
            className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="mt-0.5">
              {s.status === 'complete' ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" strokeWidth={2} />
              ) : s.status === 'locked' ? (
                <Lock className="h-8 w-8 text-gray-300" strokeWidth={2} />
              ) : (
                <Circle className="h-8 w-8 text-gray-300" strokeWidth={2} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900">{s.title}</div>
              <div className="mt-1 text-sm text-gray-500">{s.description}</div>
              {s.completedDate && (
                <div className="mt-2 text-xs text-gray-400">
                  Completed {s.completedDate}
                </div>
              )}
            </div>
            <div className="shrink-0">
              {s.status === 'complete' && (
                <MockButton variant="secondary">View</MockButton>
              )}
              {s.status === 'active' && (
                <MockButton variant="primary">{s.cta ?? 'Open'}</MockButton>
              )}
              {s.status === 'locked' && (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-md px-3 py-1.5 text-xs font-medium text-gray-400 opacity-60"
                >
                  Locked
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
