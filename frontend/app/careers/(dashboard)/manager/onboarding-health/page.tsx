'use client';

import ManagerStubPage from '@/components/manager/ManagerStubPage';

export default function OnboardingHealthPage() {
  return (
    <ManagerStubPage
      title="Onboarding Health"
      description="Signed offers awaiting onboarding, document verification status, start-date countdowns, and activation outcomes. Folds in the spec's Offers & New Hire section as a sub-view."
      phase={2}
    />
  );
}
