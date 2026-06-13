'use client';

import EvaluatorStubPage from '@/components/evaluator/EvaluatorStubPage';

export default function ScheduleSessionPage() {
  return (
    <EvaluatorStubPage
      title="Schedule Session"
      description="Self-service Zoom meeting booking for the next monthly evaluation. Evaluator picks date / time / duration / intern; backend creates the Zoom meeting and fan-outs notifications to intern + ERM + Trainer + Manager. Ships in Phase 2."
      phase={2}
    />
  );
}
