'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileSignature,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDateOnly, formatFull } from '@/lib/format-date';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ApplicationStatusBadge from '@/components/ApplicationStatusBadge';
import StatusStepper from '@/components/StatusStepper';
import type { Uuid } from '@/types';

interface InterviewBit {
  scheduledAt: string | null;
  status: string | null;
}

interface OfferBit {
  id: Uuid;
  status: string | null;
  expiresAt: string | null;
  decidedAt: string | null;
}

interface Journey {
  appliedAt: string | null;
  shortlistedAt: string | null;
  interview: InterviewBit | null;
  offer: OfferBit | null;
  hiredAt: string | null;
}

interface ActionNeeded {
  label: string | null;
  href: string | null;
}

interface ApplicationJourneyResponse {
  id: Uuid;
  position: string | null;
  entityName: string | null;
  status: string | null;
  stageIndex: number;
  isExited: boolean;
  journey: Journey | null;
  actionNeeded: ActionNeeded | null;
}

export default function CandidateApplicationsPage() {
  return (
    <ProtectedRoute requiredRoles={['APPLICANT', 'INTERN']}>
      <DashboardLayout title="My Applications">
        <Suspense fallback={<Spinner />}>
          <ApplicationsJourneyList />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div
        aria-label="Loading"
        className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"
      />
    </div>
  );
}

function ApplicationsJourneyList() {
  const search = useSearchParams();
  const justApplied = search.get('just_applied') === '1';

  const [apps, setApps] = useState<ApplicationJourneyResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ApplicationJourneyResponse[]>(
        '/api/v1/applications/me/journey',
      );
      setApps(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your applications.");
      setApps(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (apps === null && !error) return <Spinner />;

  return (
    <section>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">My Applications</h1>
      <p className="mb-6 text-sm text-slate-600">
        Each application&apos;s status journey, end to end.
      </p>

      {justApplied && (
        <div className="mb-6 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Application submitted! We&apos;ll review and get back to you.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {apps && apps.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <Briefcase
            className="mx-auto mb-3 h-8 w-8 text-gray-400"
            strokeWidth={1.5}
          />
          <p className="mb-4 text-base font-medium text-slate-700">
            You haven&apos;t applied yet.
          </p>
          <Link
            href="/careers/openings"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Browse open internships
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      )}

      {apps && apps.length > 0 && (
        <ul className="space-y-6">
          {apps.map((a) => (
            <li key={a.id}>
              <ApplicationJourneyCard app={a} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApplicationJourneyCard({ app }: { app: ApplicationJourneyResponse }) {
  const exited = app.isExited;
  const wrapClasses = exited
    ? 'rounded-lg border border-gray-200 bg-gray-50/60 p-6 opacity-95'
    : 'rounded-lg border border-gray-200 bg-white p-6';

  return (
    <article className={wrapClasses}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-gray-900">
            {app.position ?? '—'}
          </h2>
          <p className="truncate text-sm text-gray-600">{app.entityName ?? '—'}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {app.status ? <ApplicationStatusBadge status={app.status} /> : null}
          {exited && (
            <span className="text-xs text-gray-500">This application has ended.</span>
          )}
        </div>
      </header>

      <div className="px-1 py-2">
        <StatusStepper
          currentIndex={app.stageIndex}
          isExited={app.isExited}
          size="full"
        />
      </div>

      <JourneyDetailStrip app={app} />

      {app.actionNeeded?.label && app.actionNeeded.href && (
        <div className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
              <AlertCircle className="h-4 w-4" strokeWidth={2} />
              Action needed
            </div>
            <Link
              href={app.actionNeeded.href}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
            >
              {app.actionNeeded.label}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}

/**
 * One-line summary per reached stage, plus an italic "what's next" hint when
 * there's something on the horizon. Skips any stage we don't have a date for —
 * we never fabricate.
 */
function JourneyDetailStrip({ app }: { app: ApplicationJourneyResponse }) {
  const j = app.journey;
  const rows: { icon: React.ReactNode; text: React.ReactNode }[] = [];

  if (j?.appliedAt) {
    rows.push({
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />,
      text: <>Applied on {formatDateOnly(j.appliedAt)}</>,
    });
  }

  if (j?.shortlistedAt) {
    rows.push({
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />,
      text: <>Shortlisted on {formatDateOnly(j.shortlistedAt)}</>,
    });
  }

  if (j?.interview) {
    const i = j.interview;
    rows.push({
      icon: <CalendarClock className="h-3.5 w-3.5 text-blue-600" strokeWidth={2} />,
      text: (
        <>
          Interview {i.status ? <>({i.status.replace('_', ' ').toLowerCase()}) </> : null}
          {i.scheduledAt ? <>· {formatFull(i.scheduledAt)}</> : null}
        </>
      ),
    });
  }

  if (j?.offer) {
    const o = j.offer;
    const statusLabel = o.status ? o.status.toLowerCase() : 'pending';
    const decidedTail =
      o.decidedAt && (o.status === 'ACCEPTED' || o.status === 'DECLINED') ? (
        <> · responded {formatDateOnly(o.decidedAt)}</>
      ) : null;
    const expiryTail =
      o.status === 'SENT' && o.expiresAt ? (
        <> · expires {formatDateOnly(o.expiresAt)}</>
      ) : null;
    rows.push({
      icon: <FileSignature className="h-3.5 w-3.5 text-amber-600" strokeWidth={2} />,
      text: (
        <>
          Offer ({statusLabel})
          {expiryTail}
          {decidedTail}
        </>
      ),
    });
  }

  if (j?.hiredAt) {
    rows.push({
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />,
      text: <>Hired on {formatDateOnly(j.hiredAt)}</>,
    });
  }

  if (rows.length === 0) return null;

  return (
    <ul className="mt-5 space-y-1.5 border-t border-gray-100 pt-4 text-sm text-gray-700">
      {rows.map((row, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1 shrink-0">{row.icon}</span>
          <span className="min-w-0">{row.text}</span>
        </li>
      ))}
    </ul>
  );
}
