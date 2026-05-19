'use client';

import { Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function EvaluatorInternsPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_EVALUATOR', 'ADMIN']}>
      <DashboardLayout title="My Interns">
        <ComingSoon icon={Users} heading="My Interns" backHref="/careers/evaluator" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
