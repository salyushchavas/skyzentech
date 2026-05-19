'use client';

import { Video } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function ErmInterviewsPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'ADMIN']}>
      <DashboardLayout title="Interviews">
        <ComingSoon icon={Video} heading="Interviews" backHref="/careers/erm" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
