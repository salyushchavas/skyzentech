'use client';

import EvaluatorStubPage from '@/components/evaluator/EvaluatorStubPage';

export default function EvaluationHistoryPage() {
  return (
    <EvaluatorStubPage
      title="Evaluation History"
      description="Audit-style timeline of every PUBLISHED / ACKNOWLEDGED / AMENDED evaluation, filterable by intern, type (MONTHLY / MIDPOINT / FINAL / I-983), and date range. Ships in Phase 4."
      phase={4}
    />
  );
}
