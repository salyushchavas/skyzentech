'use client';

import ManagerStubPage from '@/components/manager/ManagerStubPage';

export default function RiskCenterPage() {
  return (
    <ManagerStubPage
      title="Risk Center"
      description="Cross-cutting exceptions — overdue evaluations, missed weekly meetings, low project progress, work-auth expirations within 30 days, I-983 review windows, escalations from Trainer or ERM."
      phase={4}
    />
  );
}
