'use client';

import { Building2 } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function AdminEntitiesPage() {
  return (
    <ProtectedRoute requiredRoles={['ADMIN']}>
      <DashboardLayout title="Entities">
        <ComingSoon icon={Building2} heading="Entities" backHref="/careers/admin" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
