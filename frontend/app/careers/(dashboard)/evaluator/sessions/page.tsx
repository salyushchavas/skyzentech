'use client';

import { CalendarClock } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ComingSoon from '@/components/dashboard/ComingSoon';

export default function EvaluatorSessionsPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_EVALUATOR', 'ADMIN']}>
      <DashboardLayout title="Sessions">
        <ComingSoon icon={CalendarClock} heading="Sessions" backHref="/careers/evaluator" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
