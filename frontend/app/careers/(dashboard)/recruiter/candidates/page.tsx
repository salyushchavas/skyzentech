'use client';

import { Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function RecruiterCandidatesPage() {
  return (
    <ProtectedRoute requiredRoles={['RECRUITER', 'ERM', 'ADMIN']}>
      <DashboardLayout title="Candidates">
        <ComingSoon icon={Users} heading="Candidates" backHref="/careers/recruiter" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
