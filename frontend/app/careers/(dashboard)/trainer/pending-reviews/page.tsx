import StubPage from '@/components/trainer/StubPage';

export default function TrainerPendingReviewsPage() {
  return (
    <StubPage
      title="Pending Reviews"
      description="Doc §9 queue of submitted project work awaiting review. Feedback Form with 4 decisions (Complete / Revision required / Escalate / No action yet), technical + communication scores 1-5, blockers, next action + due date, reviewed links."
      phase={3}
    />
  );
}
