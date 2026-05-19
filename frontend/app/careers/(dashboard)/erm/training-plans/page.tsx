'use client';

import { FileBadge } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function ErmTrainingPlansPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'ADMIN']}>
      <DashboardLayout title="I-983 Plans">
        <ComingSoon icon={FileBadge} heading="I-983 Plans" backHref="/careers/erm" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
