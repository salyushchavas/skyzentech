'use client';

import { FolderArchive } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function HrDocumentsPage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="Document Vault">
        <ComingSoon icon={FolderArchive} heading="Document Vault" backHref="/careers/hr" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
