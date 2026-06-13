'use client';

import EvaluatorStubPage from '@/components/evaluator/EvaluatorStubPage';

export default function EvaluatorSettingsPage() {
  return (
    <EvaluatorStubPage
      title="Settings"
      description="Per-Evaluator preferences: default session duration, reminder cadence, email digest frequency, and rubric template selection. Ships in Phase 4."
      phase={4}
    />
  );
}
