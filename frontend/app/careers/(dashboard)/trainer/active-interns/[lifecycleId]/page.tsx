'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import StateBadge from '@/components/trainer/StateBadge';
import ProjectSlotIndicator from '@/components/trainer/ProjectSlotIndicator';
import ReportingStructureBadge from '@/components/trainer/ReportingStructureBadge';
import type {
  ActiveInternDetail,
  RecentMeetingRow,
  RecentProjectRow,
  RecentSubmissionRow,
  RecentTimesheetRow,
} from '@/components/trainer/types';

type RouteParams = { lifecycleId: string };

const POLL_MS = 60_000;

export default function ActiveInternDetailPage(props: {
  params: Promise<RouteParams>;
}) {
  const { lifecycleId } = use(props.params);
  const [d, setD] = useState<ActiveInternDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ActiveInternDetail>(
        `/api/v1/trainer/active-interns/${lifecycleId}`,
      );
      setD(res.data);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Failed to load intern detail');
    }
  }, [lifecycleId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      void load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (err && !d) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {err}
        </p>
      </div>
    );
  }
  if (!d) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-6">
        <div className="h-8 w-72 animate-pulse rounded bg-slate-100" />
        <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            <Link href="/careers/trainer/active-interns" className="hover:text-slate-700">
              ← Active interns
            </Link>
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {d.intern.fullName ?? '(unknown)'}
          </h1>
          <p className="text-xs text-slate-500">
            {d.intern.employeeId ?? '—'} ·{' '}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
              {d.intern.technologyTitle ?? '—'}
            </span>
            {d.i983StatusBadge && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                {d.i983StatusBadge}
              </span>
            )}
          </p>
        </div>
        <div className="text-xs text-slate-500">
          <p>{d.intern.email ?? '—'}</p>
          <p>{d.intern.phone ?? '—'}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Profile">
          <dl className="space-y-1 text-xs">
            <Row k="Email" v={d.intern.email} />
            <Row k="Phone" v={d.intern.phone} />
            <Row k="Technology" v={d.intern.technologyTitle} />
            <Row k="Start date" v={d.intern.startDate} />
            <Row k="Employee ID" v={d.intern.employeeId} />
          </dl>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Reporting structure
            </h4>
            <ReportingStructureBadge reporting={d.summary.reportingStructure} />
          </div>
        </Card>

        <Card title="Signed offer" subtitle="Per ANVI policy (Trainer view)">
          <dl className="space-y-1 text-xs">
            <Row k="Role" v={d.signedOffer.roleTitle} />
            <Row k="Compensation" v={d.signedOffer.compensationSummary} />
            <Row k="Tentative start" v={d.signedOffer.tentativeStartDate} />
            <Row
              k="Signed at"
              v={
                d.signedOffer.signedAt
                  ? new Date(d.signedOffer.signedAt).toLocaleString()
                  : null
              }
            />
          </dl>
        </Card>

        <Card title="Current month state">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Projects
            </span>
            <ProjectSlotIndicator
              project1={d.summary.currentMonthProjects.project1}
              project2={d.summary.currentMonthProjects.project2}
              monthYear={d.summary.currentMonthProjects.monthYear}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
            <span>Meeting:</span>{' '}
            <StateBadge state={d.summary.weeklyMeeting.state} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-700">
            <span>Evaluation:</span>{' '}
            <StateBadge state={d.summary.evaluation.state} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-700">
            <span>Timesheet:</span>{' '}
            <StateBadge state={d.summary.timesheet.state} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardWithCta
          title="Recent projects"
          cta="Assign new project"
          ctaDisabled
          ctaTip="Coming in Trainer Phase 2"
        >
          {d.recentProjects.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {d.recentProjects.map((p) => (
                <RecentProjectItem key={p.id} p={p} />
              ))}
            </ul>
          )}
        </CardWithCta>

        <CardWithCta
          title="Recent weekly meetings"
          cta="Schedule new"
          ctaDisabled
          ctaTip="Coming in Trainer Phase 3"
        >
          {d.recentMeetings.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {d.recentMeetings.map((m) => (
                <RecentMeetingItem key={m.id} m={m} />
              ))}
            </ul>
          )}
        </CardWithCta>

        <CardWithCta
          title="Recent submissions"
          cta="Review pending"
          ctaDisabled
          ctaTip="Coming in Trainer Phase 3"
        >
          {d.recentSubmissions.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {d.recentSubmissions.map((s) => (
                <RecentSubmissionItem key={s.id} s={s} />
              ))}
            </ul>
          )}
        </CardWithCta>

        <Card title="Recent timesheets" subtitle="Read-only (Evaluator/Manager owns approval)">
          {d.recentTimesheets.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {d.recentTimesheets.map((t) => (
                <RecentTimesheetItem key={t.id} t={t} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Recent activity" subtitle="Trainer-visible audit events">
        {d.recentActivity.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1.5 text-xs">
            {d.recentActivity.slice(0, 20).map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0"
              >
                <span className="truncate">
                  <span className="font-medium text-slate-900">
                    {a.actorName ?? 'system'}
                  </span>{' '}
                  <span className="text-slate-600">
                    {a.action ?? '—'} on {a.entityType ?? '—'}
                  </span>
                </span>
                <span className="text-[10px] tabular-nums text-slate-500">
                  {a.at ? new Date(a.at).toLocaleString() : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function CardWithCta({
  title,
  cta,
  ctaDisabled,
  ctaTip,
  children,
}: {
  title: string;
  cta: string;
  ctaDisabled: boolean;
  ctaTip?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          disabled={ctaDisabled}
          title={ctaTip}
          className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cta}
        </button>
      </header>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-0.5">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-800">{v ?? '—'}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-slate-500">Nothing yet.</p>;
}

function RecentProjectItem({ p }: { p: RecentProjectRow }) {
  return (
    <li className="rounded-md border border-slate-100 p-2 text-xs">
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-slate-900">{p.title ?? '(untitled)'}</span>
        <span className="text-[10px] text-slate-500">
          {p.monthYear ?? '—'}
          {p.projectNumber ? ` · #${p.projectNumber}` : ''}
        </span>
      </div>
      <div className="mt-0.5 text-slate-600">
        Status: <strong>{p.status}</strong>
        {p.dueDate ? ` · due ${p.dueDate}` : ''}
        {p.reviewedAt ? ' · reviewed' : ''}
      </div>
    </li>
  );
}

function RecentMeetingItem({ m }: { m: RecentMeetingRow }) {
  return (
    <li className="rounded-md border border-slate-100 p-2 text-xs">
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-slate-900">{m.topic ?? '(no topic)'}</span>
        <span className="text-[10px] text-slate-500">
          {m.scheduledFor ? new Date(m.scheduledFor).toLocaleString() : '—'}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-600">
        <StateBadge state={mapMeetingStatus(m.status)} variant="meeting" />
        {m.notesExcerpt && <span>· {m.notesExcerpt}</span>}
      </div>
    </li>
  );
}

function mapMeetingStatus(s: string): string {
  if (s === 'NO_SHOW') return 'MISSED';
  if (s === 'CANCELLED') return 'RESCHEDULED';
  return s;
}

function RecentSubmissionItem({ s }: { s: RecentSubmissionRow }) {
  return (
    <li className="rounded-md border border-slate-100 p-2 text-xs">
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-slate-900">
          {s.projectTitle ?? '(unknown project)'}
        </span>
        <span className="text-[10px] text-slate-500">
          {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—'}
        </span>
      </div>
      <div className="mt-0.5 text-slate-600">
        Tech {s.technicalScore ?? '—'}/5 · Comm {s.communicationScore ?? '—'}/5
        {s.nextAction ? ' · Next: ' + s.nextAction : ''}
      </div>
    </li>
  );
}

function RecentTimesheetItem({ t }: { t: RecentTimesheetRow }) {
  return (
    <li className="flex items-center justify-between rounded-md border border-slate-100 p-2 text-xs">
      <span className="font-medium text-slate-900">{t.weekStart ?? '—'}</span>
      <span className="flex items-center gap-2 text-slate-600">
        <span>{t.hours}h</span>
        <StateBadge state={t.status} variant="timesheet" />
      </span>
    </li>
  );
}
