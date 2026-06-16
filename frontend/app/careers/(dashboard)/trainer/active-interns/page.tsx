'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import PeriodPicker, {
  formatPeriod,
  usePeriodFromUrl,
} from '@/components/ui/PeriodPicker';
import MonthlyRosterTable from '@/components/roster/MonthlyRosterTable';
import type { ActiveInternListPage } from '@/components/trainer/types';

/**
 * Phase A trainer roster — reworked to use the shared
 * {@link MonthlyRosterTable} so Trainer, Manager, and ERM can't drift
 * visually or behaviourally. Scope = single org-wide Trainer → backend
 * returns every intern active during the requested month (no
 * trainer_id filter).
 */

const POLL_MS = 60_000;

export default function ActiveInternsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <ActiveInternsInner />
    </Suspense>
  );
}

function ActiveInternsInner() {
  const [period, setPeriod] = usePeriodFromUrl();
  const [data, setData] = useState<ActiveInternListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('y', String(period.year));
      params.set('m', String(period.month));
      params.set('page', '0');
      params.set('pageSize', '100');
      const res = await api.get<ActiveInternListPage>(
        `/api/v1/trainer/active-interns?${params.toString()}`,
      );
      setData(res.data);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [period.year, period.month]);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Monthly intern roster</h1>
          <p className="text-xs text-slate-500">
            {formatPeriod(period)} · all interns active that month
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </header>

      <MonthlyRosterTable
        data={data}
        loading={loading}
        err={err}
        periodLabel={formatPeriod(period)}
        detailHref={(id) => `/careers/trainer/active-interns/${id}`}
      />
    </div>
  );
}
