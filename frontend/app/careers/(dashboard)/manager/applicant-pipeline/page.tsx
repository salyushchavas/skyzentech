'use client';

import ManagerStubPage from '@/components/manager/ManagerStubPage';

export default function ApplicantPipelinePage() {
  return (
    <ManagerStubPage
      title="Applicant Pipeline"
      description="Funnel of every applicant from registration through interview, decision, offer-sent, and offer-signing — with time-in-stage, conversion rates, and drill-downs into ERM's pipeline. Folds in the spec's Interviews section as a sub-view."
      phase={2}
    />
  );
}
