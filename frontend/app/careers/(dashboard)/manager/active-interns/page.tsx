'use client';

import ManagerStubPage from '@/components/manager/ManagerStubPage';

export default function ActiveInternsPage() {
  return (
    <ManagerStubPage
      title="Active Interns"
      description="Roster of every active intern under your span of control — project assignment, weekly meeting status, evaluation cadence, project progress. Folds in the spec's Training Delivery + Evaluation Delivery sections as sub-views."
      phase={3}
    />
  );
}
