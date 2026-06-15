'use client';

import ManagerStubPage from '@/components/manager/ManagerStubPage';

export default function TimesheetApprovalsPage() {
  return (
    <ManagerStubPage
      title="Timesheet Approvals"
      description="Submitted / approved / rejected hours across every intern in your span of control, with bulk approve/reject and rejection-reason taxonomy. Approval is the Manager's primary workflow surface."
      phase={3}
    />
  );
}
