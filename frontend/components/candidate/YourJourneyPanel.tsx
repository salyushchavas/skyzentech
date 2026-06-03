'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import JourneyTimeline, { type TimelineStep } from './JourneyTimeline';
import NextStepCard, { type NextStepData } from './NextStepCard';
import RecentActivityFeed, { type RecentUpdate } from './RecentActivityFeed';

const POLL_INTERVAL_MS = 30_000;

const STAGE_LABEL: Record<string, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  ONBOARDING: 'Onboarding',
  HIRED: 'Hired',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  REJECTED: 'Closed',
};

interface DashboardStatus {
  overallStage: string;
  nextStep: NextStepData | null;
  timeline: TimelineStep[];
  recentUpdates: RecentUpdate[];
}

/**
 * "Your Journey" panel — polls /api/v1/candidate/dashboard-status every 30s,
 * surfaces a stage pill + next-step card + full timeline + recent activity.
 * The panel pauses polling while the tab is hidden (visibilitychange) and
 * resumes on focus. Network blips are swallowed and the last-cached data
 * stays visible with a small "Reconnecting…" pill.
 */
export default function YourJourneyPanel() {
  const [data, setData] = useState<DashboardStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<DashboardStatus>('/api/v1/candidate/dashboard-status');
      setData(res.data);
      setError(null);
      setReconnecting(false);
    } catch (err: any) {
      if (data == null) {
        setError(err?.response?.data?.error ?? "Couldn't load your timeline.");
      } else {
        setReconnecting(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current != null) return;
    intervalRef.current = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);
  }, [load]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    void load();
    if (!document.hidden) startPolling();
    const onVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        void load();
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopPolling();
    };
  }, [load, startPolling, stopPolling]);

  if (error && data == null) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
        >
          Retry
        </button>
      </section>
    );
  }

  if (data == null) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
        <div className="mt-3 h-14 animate-pulse rounded bg-slate-100" />
        <div className="mt-3 h-40 animate-pulse rounded bg-slate-100" />
      </section>
    );
  }

  const stageLabel = STAGE_LABEL[data.overallStage] ?? data.overallStage;
  const stageContext = data.nextStep?.isWaiting
    ? `Awaiting ${data.nextStep.waitingFor ?? 'a response'}`
    : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Your Journey</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Every step from application to active intern — automatically updated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reconnecting && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              <RefreshCw className="h-3 w-3 animate-spin" strokeWidth={2.5} />
              Reconnecting…
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent-dark ring-1 ring-accent/30">
            {stageLabel}
            {stageContext && (
              <>
                <span className="text-accent-dark/50">•</span>
                <span className="font-normal text-accent-dark/80">{stageContext}</span>
              </>
            )}
          </span>
        </div>
      </header>

      {data.nextStep && (
        <div className="mb-4">
          <NextStepCard step={data.nextStep} />
        </div>
      )}

      <JourneyTimeline steps={data.timeline} />

      <div className="mt-4">
        <RecentActivityFeed items={data.recentUpdates ?? []} />
      </div>
    </section>
  );
}
