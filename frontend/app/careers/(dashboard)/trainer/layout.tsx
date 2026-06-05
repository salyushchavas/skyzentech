'use client';

import type { ReactNode } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import TrainerSidebar from '@/components/trainer/TrainerSidebar';

/**
 * Trainer Phase 0 — shell layout for the 9-item Trainer surface
 * (doc §4). RBAC: TRAINER + SUPER_ADMIN. Phase 1 will hang a right-
 * side panel placeholder off this shell; for Phase 0 we ship the
 * sidebar + main column only.
 */
export default function TrainerLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['TRAINER', 'SUPER_ADMIN']}>
      <div className="ds flex h-screen overflow-hidden bg-slate-50">
        <TrainerSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
