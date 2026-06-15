'use client';

import Link from 'next/link';
import {
  BadgeCheck,
  CalendarRange,
  ClipboardList,
  FileBarChart2,
  GraduationCap,
  ShieldAlert,
  UserMinus,
  Users,
} from 'lucide-react';

/**
 * Manager Phase 0 — Executive Overview placeholder. The real
 * KPI grid, pipeline funnel, escalation list, and team workload
 * heatmap land in Manager Phase 1. This page exists so logging in
 * as a Manager lands somewhere coherent + the sidebar's nine deep
 * destinations are reachable.
 */
export default function ManagerHomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
          Executive Overview
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Manager Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Cross-cutting oversight of the applicant pipeline, onboarding,
          active interns, timesheet approvals, and risk. Phase 0 ships the
          shell + navigation; KPI roll-ups land in Phase 1.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Sections
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SectionCard
            href="/careers/manager/applicant-pipeline"
            icon={<Users className="h-4 w-4" />}
            title="Applicant Pipeline"
            body="Funnel from registration to offer signing, with interview decisions and time-in-stage."
            phase={2}
          />
          <SectionCard
            href="/careers/manager/onboarding-health"
            icon={<BadgeCheck className="h-4 w-4" />}
            title="Onboarding Health"
            body="Signed offers, document verification, start-date countdowns, activation status."
            phase={2}
          />
          <SectionCard
            href="/careers/manager/active-interns"
            icon={<GraduationCap className="h-4 w-4" />}
            title="Active Interns"
            body="Project assignment, weekly meetings, evaluation cadence, project progress."
            phase={3}
          />
          <SectionCard
            href="/careers/manager/timesheet-approvals"
            icon={<ClipboardList className="h-4 w-4" />}
            title="Timesheet Approvals"
            body="Submitted / approved / rejected hours across all interns in your span of control."
            phase={3}
          />
          <SectionCard
            href="/careers/manager/risk-center"
            icon={<ShieldAlert className="h-4 w-4" />}
            title="Risk Center"
            body="Cross-cutting exceptions, overdue evaluations, work-auth expirations, escalations."
            phase={4}
          />
          <SectionCard
            href="/careers/manager/reports"
            icon={<FileBarChart2 className="h-4 w-4" />}
            title="Reports"
            body="Monthly roll-ups, team workload, CSV exports for HR / leadership reviews."
            phase={4}
          />
          <SectionCard
            href="/careers/manager/inactive-interns"
            icon={<UserMinus className="h-4 w-4" />}
            title="Inactive Interns"
            body="Completed, resigned, terminated interns with final evaluations + exit summaries."
            phase={4}
          />
          <SectionCard
            href="/careers/manager/settings"
            icon={<CalendarRange className="h-4 w-4" />}
            title="Settings"
            body="Per-Manager preferences — span of control, notification cadence, default views."
            phase={5}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Phase 0 scope</p>
        <p className="mt-1">
          This is the scaffold only — every section above is a placeholder
          today. The Manager↔intern association is the per-intern{' '}
          <code className="rounded bg-white px-1 py-0.5 text-[11px]">
            intern_lifecycles.manager_id
          </code>{' '}
          column ERM sets when assigning a Manager. Phase 1 will scope all
          aggregations to interns where{' '}
          <code className="rounded bg-white px-1 py-0.5 text-[11px]">
            manager_id == caller
          </code>
          .
        </p>
      </section>
    </div>
  );
}

function SectionCard({
  href, icon, title, body, phase,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  phase: number;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-teal-300 hover:shadow"
    >
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
          {icon}
          {title}
        </p>
        <span className="text-[10px] text-slate-400">P{phase}</span>
      </div>
      <p className="mt-2 text-xs text-slate-700">{body}</p>
    </Link>
  );
}
