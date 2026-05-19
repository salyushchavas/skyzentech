'use client';

import { ClipboardList } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function EvaluatorAssignmentsPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_EVALUATOR', 'ADMIN']}>
      <DashboardLayout title="Assignments">
        <ComingSoon icon={ClipboardList} heading="Assignments" backHref="/careers/evaluator" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
