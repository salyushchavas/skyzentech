'use client';

import EvaluatorStubPage from '@/components/evaluator/EvaluatorStubPage';

export default function PendingEvaluationsPage() {
  return (
    <EvaluatorStubPage
      title="Pending Evaluations"
      description="Queue of evaluations in DRAFT / SCHEDULED / IN_PROGRESS state waiting for the Evaluator to compose, score, and publish. Includes the 4-decision feedback flow + amendment trail. Ships in Phase 2."
      phase={2}
    />
  );
}
