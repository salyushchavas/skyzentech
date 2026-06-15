'use client';

import ManagerStubPage from '@/components/manager/ManagerStubPage';

export default function ManagerReportsPage() {
  return (
    <ManagerStubPage
      title="Reports"
      description="Monthly roll-ups across the Manager's span of control — applicant funnel, onboarding throughput, active-intern roster, timesheet posture, evaluation distribution. CSV exports for HR / leadership reviews. Folds in the spec's Team Workload section as a sub-view."
      phase={4}
    />
  );
}
