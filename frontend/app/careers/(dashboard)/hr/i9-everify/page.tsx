'use client';

import { BadgeCheck } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function HrI9EverifyPage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="I-9 / E-Verify">
        <ComingSoon icon={BadgeCheck} heading="I-9 / E-Verify" backHref="/careers/hr" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
