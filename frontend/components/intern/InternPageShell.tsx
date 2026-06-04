'use client';

import type { ReactNode } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import InternStepper from './InternStepper';
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
 *   {children}
 *
 * Pages don't need to import the stepper or PageHeader directly.
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
      {children}
    </>
  );
}
