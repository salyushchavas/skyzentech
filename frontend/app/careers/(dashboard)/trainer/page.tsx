'use client';

import { RefreshCw } from 'lucide-react';
import { useTrainerDashboard } from '@/components/trainer/TrainerDashboardContext';
import KPIGrid from '@/components/trainer/KPIGrid';
import TodayMeetingsCard from '@/components/trainer/TodayMeetingsCard';
import RecentActivityCard from '@/components/trainer/RecentActivityCard';

export default function TrainerHomePage() {
  const {
    dashboard,
    dashboardLoading,
    dashboardError,
    refreshDashboard,
  } = useTrainerDashboard();

  const greeting = dashboard?.caller.firstName
    ? `Hi, ${dashboard.caller.firstName}`
    : 'Trainer Home';
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const asOf = dashboard?.asOf
    ? new Date(dashboard.asOf).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{greeting}</h1>
          <p className="text-xs text-slate-500">
            {today}
            {asOf ? ` · as of ${asOf}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshDashboard()}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          Refresh
        </button>
      </header>

      {dashboardError && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {dashboardError}
        </p>
      )}

      <KPIGrid
        kpis={dashboard?.kpis ?? {}}
        loading={dashboardLoading && !dashboard}
      />

      <TodayMeetingsCard meetings={dashboard?.todayMeetings ?? []} />

      <RecentActivityCard rows={dashboard?.recentActivity ?? []} />

      <footer className="border-t border-slate-200 pt-3 text-[11px] text-slate-500">
        Last updated {asOf ?? '—'} · 6 active KPIs · Role: Trainer
      </footer>
    </div>
  );
}
