'use client';

import ManagerStubPage from '@/components/manager/ManagerStubPage';

export default function InactiveInternsPage() {
  return (
    <ManagerStubPage
      title="Inactive Interns"
      description="Completed, resigned, terminated interns under your span of control, with final evaluations, exit summaries, rehire-eligibility verdicts, and access-revocation status."
      phase={4}
    />
  );
}
