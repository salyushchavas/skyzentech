'use client';

import { Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function AdminUsersPage() {
  return (
    <ProtectedRoute requiredRoles={['ADMIN']}>
      <DashboardLayout title="Users">
        <ComingSoon icon={Users} heading="Users" backHref="/careers/admin" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
