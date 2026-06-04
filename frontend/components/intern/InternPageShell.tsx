'use client';

import type { ReactNode } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import InternStepper from './InternStepper';
import RightSidePanel from './RightSidePanel';
import { useInternDashboard } from './InternDashboardContext';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}

/**
 * Standard top-of-page wrapper for every intern surface. Renders:
 *
 *   <PageHeader title subtitle />
 *   <InternStepper steps />            ← driven by the dashboard context
 *   <main> {children} </main>
 *   <RightSidePanel />                 ← Phase 7 — contacts + reminders + bell + help
 *
 * On lg+ screens the right side panel sits in a 1/4 column next to the
 * main content; on smaller viewports it tucks underneath.
 */
export default function InternPageShell({ title, subtitle, children }: Props) {
  const { data, loading } = useInternDashboard();

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      {data && <InternStepper steps={data.stepper} />}
      {!data && loading && (
        <div className="mb-6 h-12 animate-pulse rounded-md bg-slate-100" aria-hidden />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <main className="min-w-0">{children}</main>
        <RightSidePanel />
      </div>
    </>
  );
}
