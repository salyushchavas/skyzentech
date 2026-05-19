'use client';

import { Plus } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';

interface Entity {
  name: string;
  flag: string;
  openPostings: number;
  activeInterns: number;
  hiredYtd: number;
  created: string;
}

const ENTITIES: Entity[] = [
  { name: 'Stellar USA', flag: '🇺🇸', openPostings: 3, activeInterns: 4, hiredYtd: 6, created: 'Mar 1, 2026' },
  { name: 'Skyzen', flag: '🇺🇸', openPostings: 1, activeInterns: 2, hiredYtd: 4, created: 'Mar 1, 2026' },
  { name: 'CEO Foundry', flag: '🇺🇸', openPostings: 1, activeInterns: 1, hiredYtd: 2, created: 'Apr 4, 2026' },
  { name: 'Blueera', flag: '🇺🇸', openPostings: 0, activeInterns: 1, hiredYtd: 1, created: 'Apr 22, 2026' },
];

export default function AdminEntitiesPage() {
  return (
    <ProtectedRoute requiredRoles={['ADMIN']}>
      <DashboardLayout title="Staffing Entities">
        <PreviewShell>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Manage the staffing entities under the Skyzen network.
            </p>
            <MockButton icon={<Plus className="h-4 w-4" />}>Add Entity</MockButton>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ENTITIES.map((e) => (
              <article
                key={e.name}
                className="rounded-lg border border-gray-200 bg-white p-5"
              >
                <header className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900">{e.name}</span>
                    <span className="text-base">{e.flag}</span>
                  </div>
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Active
                  </span>
                </header>

                <div className="mb-4 grid grid-cols-3 gap-2 rounded-md bg-gray-50 p-3">
                  <MiniStat label="Open" value={e.openPostings} />
                  <MiniStat label="Interns" value={e.activeInterns} />
                  <MiniStat label="Hired YTD" value={e.hiredYtd} />
                </div>

                <footer className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">Created {e.created}</div>
                  <div className="flex gap-1.5">
                    <MockButton variant="ghost">Edit</MockButton>
                    <MockButton variant="ghost">View Postings</MockButton>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </PreviewShell>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}
