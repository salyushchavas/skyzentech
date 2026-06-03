'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Inbox,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatRelative } from '@/lib/format-date';
import type { ReportingManagerDashboard } from '@/types';
import {
  ActionRow,
  Avatar,
  Button,
  EmptyState,
  PageHeader,
  QueueCard,
  Skeleton,
  StatusPill,
  Tabs,
  TabPanel,
} from '@/components/ui';

type TabKey = 'qa' | 'timesheets' | 'all';

export default function ReportingManagerDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['REPORTING_MANAGER', 'SUPER_ADMIN']}>
      <DashboardLayout title="Reporting Manager">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [data, setData] = useState<ReportingManagerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('qa');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ReportingManagerDashboard>(
        '/api/v1/reporting-manager/dashboard',
      );
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const signOffsDue = useMemo(
    () => data?.qaInProgress?.filter((s) => s.status === 'CONDUCTED').length ?? 0,
    [data],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const qaTabs = [
    { key: 'qa', label: 'Q&A Queue', count: data.projectsAwaitingQa.length + data.qaInProgress.length },
    { key: 'timesheets', label: 'Timesheets', count: data.pendingTimesheets.length },
    { key: 'all', label: 'All Assignments' },
  ];

  return (
    <section className="space-y-8">
      <PageHeader
        title="Reporting Manager"
        subtitle="What needs your attention right now — Q&A sessions, timesheets, and sign-offs."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QueueCard
          icon={CalendarClock}
          accent="info"
          title="Projects awaiting Q&A"
          description="Tech-approved projects ready for a viva."
          count={data.pendingQaCount}
          ctaLabel="Open queue"
          onCtaClick={() => setTab('qa')}
        />
        <QueueCard
          icon={ClipboardCheck}
          accent="warning"
          title="Timesheets pending review"
          description="Submitted weeks awaiting approval."
          count={data.pendingTimesheetCount}
          ctaLabel="Open queue"
          onCtaClick={() => setTab('timesheets')}
        />
        <QueueCard
          icon={CheckCircle2}
          accent="warning"
          title="Sign-offs due this week"
          description="Conducted sessions awaiting final sign-off."
          count={signOffsDue}
          ctaLabel="Open queue"
          onCtaClick={() => setTab('qa')}
        />
      </div>

      <Tabs tabs={qaTabs} activeKey={tab} onChange={(k) => setTab(k as TabKey)}>
        <TabPanel value="qa">
          <QaQueue data={data} />
        </TabPanel>
        <TabPanel value="timesheets">
          <TimesheetQueue data={data} />
        </TabPanel>
        <TabPanel value="all">
          <AllAssignments data={data} />
        </TabPanel>
      </Tabs>
    </section>
  );
}

function QaQueue({ data }: { data: ReportingManagerDashboard }) {
  const empty = data.projectsAwaitingQa.length === 0 && data.qaInProgress.length === 0;
  if (empty) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No Q&A items right now"
        description="Projects that reach Tech Approved appear here. You'll get a heads-up via the queue card above."
      />
    );
  }
  return (
    <div className="space-y-2">
      {data.projectsAwaitingQa.map((p) => (
        <ActionRow
          key={p.projectId}
          avatar={<Avatar name={p.internName ?? '—'} size="md" />}
          primary={p.projectTitle}
          secondary={
            <>
              {p.internName ?? '—'}
              {p.techApprovedAt && <> · approved {formatRelative(p.techApprovedAt)}</>}
            </>
          }
          status={<StatusPill status="TECH_APPROVED" />}
          actions={
            <Link
              href={`/careers/reporting-manager/sessions/new?projectId=${p.projectId}`}
            >
              <Button size="sm" leftIcon={<CalendarClock className="h-3.5 w-3.5" />}>
                Schedule
              </Button>
            </Link>
          }
        />
      ))}
      {data.qaInProgress.map((s) => (
        <ActionRow
          key={s.id}
          avatar={<Avatar name={s.internName ?? '—'} size="md" />}
          primary={s.projectTitle ?? 'Session'}
          secondary={<>{s.internName ?? '—'} · {formatRelative(s.scheduledAt)}</>}
          status={<StatusPill status={s.status} />}
          href={`/careers/reporting-manager/sessions/${s.id}`}
        />
      ))}
    </div>
  );
}

function TimesheetQueue({ data }: { data: ReportingManagerDashboard }) {
  if (data.pendingTimesheets.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nothing to review"
        description="Submitted timesheets show up here. You'll see hours and submission time at a glance."
      />
    );
  }
  return (
    <div className="space-y-2">
      {data.pendingTimesheets.map((t) => (
        <ActionRow
          key={t.id}
          avatar={<Avatar name={t.internName ?? '—'} size="md" />}
          primary={t.internName ?? '—'}
          secondary={
            <>
              Week of {t.weekStart} · {Number(t.totalHours).toFixed(1)} hrs
              {t.submittedAt && <> · submitted {formatRelative(t.submittedAt)}</>}
            </>
          }
          status={<StatusPill status="SUBMITTED" />}
          actions={
            <Link href={`/careers/reporting-manager/timesheets/${t.id}`}>
              <Button size="sm" variant="secondary">
                Review
              </Button>
            </Link>
          }
        />
      ))}
    </div>
  );
}

function AllAssignments({ data }: { data: ReportingManagerDashboard }) {
  const empty =
    data.projectsAwaitingQa.length === 0
    && data.qaInProgress.length === 0
    && data.pendingTimesheets.length === 0;
  if (empty) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nothing queued up"
        description="New assignments will appear here as interns submit work and timesheets."
      />
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Q&A queue</p>
        <QaQueue data={data} />
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Timesheets</p>
        <TimesheetQueue data={data} />
      </div>
    </div>
  );
}
