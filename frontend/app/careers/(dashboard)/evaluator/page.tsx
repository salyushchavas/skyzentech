'use client';

import EvaluatorStubPage from '@/components/evaluator/EvaluatorStubPage';

export default function EvaluatorHomePage() {
  return (
    <EvaluatorStubPage
      title="Evaluator Home"
      description="Aggregate context for the current monthly evaluation cycle: active evaluees, sessions scheduled this month, pending acknowledgments, and recent activity. Ships in Phase 1."
      phase={1}
    />
  );
}
