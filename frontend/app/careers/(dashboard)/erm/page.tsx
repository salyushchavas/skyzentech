'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import { useErmDashboard } from '@/components/erm/ErmDashboardContext';
import KPIGrid from '@/components/erm/KPIGrid';
import ExceptionSummary from '@/components/erm/ExceptionSummary';
import RecentActivityCard from '@/components/erm/RecentActivityCard';
import TodayInterviewsCard from '@/components/erm/TodayInterviewsCard';
import ScopeToggle from '@/components/erm/ScopeToggle';
import ErmRightSidePanel from '@/components/erm/ErmRightSidePanel';

export default function ErmHomePage() {
  const { data, loading, error, scope, setScope } = useErmDashboard();

  const callerName = data
    ? [data.caller.firstName, data.caller.lastName].filter(Boolean).join(' ')
    : '';
  const subtitle = data
    ? `Operational tower readout · scope: ${scope === 'mine' ? 'My interns' : 'All interns'}`
    : 'Loading dashboard…';
  const asOfText = data?.asOf ? new Date(data.asOf).toLocaleString() : '';

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <PageHeader
              title={callerName ? `ERM Control — ${callerName}` : 'ERM Control'}
              subtitle={subtitle}
            />
          </div>
          <div className="pt-1">
            <ScopeToggle scope={scope} onChange={setScope} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0 space-y-6">
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}

            <KPIGrid kpis={data?.kpis ?? null} loading={loading} />

            <ExceptionSummary
              counts={data?.exceptions.counts ?? null}
              topUrgent={data?.exceptions.topUrgent ?? []}
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <TodayInterviewsCard />
              <RecentActivityCard entries={data?.recentActivity ?? []} />
            </div>

            <footer className="border-t border-slate-200 pt-3 text-[11px] text-slate-500">
              Last updated {asOfText || '—'} · Scope: {scope}
            </footer>
          </main>

          <ErmRightSidePanel />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
