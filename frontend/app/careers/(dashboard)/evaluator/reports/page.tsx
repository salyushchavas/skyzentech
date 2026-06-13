'use client';

import EvaluatorStubPage from '@/components/evaluator/EvaluatorStubPage';

export default function EvaluatorReportsPage() {
  return (
    <EvaluatorStubPage
      title="Reports"
      description="Monthly evaluation roll-up scoped to this Evaluator's interns: evaluations published vs missed, acknowledgment lag, average scores by rubric. CSV download. Ships in Phase 4."
      phase={4}
    />
  );
}
