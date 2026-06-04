'use client';

import type { ReactNode } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { InternDashboardProvider } from '@/components/intern/InternDashboardContext';

/**
 * Intern segment layout. Every intern page lives inside:
 *   ProtectedRoute (INTERN gate)
 *     InternDashboardProvider (single /api/v1/intern/dashboard fetch + 30s poll)
 *       DashboardLayout (sidebar + topbar + main column)
 *         {page content — wrapped in InternPageShell for PageHeader + Stepper}
 *
 * The provider broadcasts mode, stepper, module visibility, next-action,
 * and contacts to every child via {@code useInternDashboard()}.
 */
export default function InternSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute requiredRoles={['INTERN']}>
      <InternDashboardProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </InternDashboardProvider>
    </ProtectedRoute>
  );
}
