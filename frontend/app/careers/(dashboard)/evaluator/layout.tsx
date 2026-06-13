'use client';

import type { ReactNode } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import EvaluatorSidebar from '@/components/evaluator/EvaluatorSidebar';
import EvaluatorRightSidePanel from '@/components/evaluator/EvaluatorRightSidePanel';

/**
 * Evaluator Phase 0 — 3-column shell on xl: sidebar + main + right-side
 * panel. RBAC: EVALUATOR + SUPER_ADMIN. Phase 1 will introduce an
 * EvaluatorDashboardProvider for shared 60s polling; Phase 0 keeps the
 * shell prop-free.
 */
export default function EvaluatorLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['EVALUATOR', 'SUPER_ADMIN']}>
      <div className="ds flex h-screen overflow-hidden bg-slate-50">
        <EvaluatorSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <EvaluatorRightSidePanel />
      </div>
    </ProtectedRoute>
  );
}
