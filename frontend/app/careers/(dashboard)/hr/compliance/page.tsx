'use client';

import { ShieldCheck } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function HrCompliancePage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="Compliance">
        <ComingSoon icon={ShieldCheck} heading="Compliance" backHref="/careers/hr" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
