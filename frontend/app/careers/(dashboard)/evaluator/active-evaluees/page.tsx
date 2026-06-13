'use client';

import EvaluatorStubPage from '@/components/evaluator/EvaluatorStubPage';

export default function ActiveEvalueesPage() {
  return (
    <EvaluatorStubPage
      title="Active Evaluees"
      description="List of interns assigned to this Evaluator (auto-linked at offer sign from DEFAULT_EVALUATOR_EMAIL). Each row shows intern + applicant_id + technology + months in program + last evaluation date. Ships in Phase 1."
      phase={1}
    />
  );
}
