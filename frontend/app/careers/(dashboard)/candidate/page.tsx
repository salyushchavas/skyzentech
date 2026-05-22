'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Clock,
  FileSignature,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { formatRelative } from '@/lib/format-date';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ApplicationStatusBadge from '@/components/ApplicationStatusBadge';
import StatusStepper from '@/components/StatusStepper';
import type { Uuid } from '@/types';

interface NextStep {
  type: string; // OFFER | INTERVIEW | ONBOARDING | WORK | SHORTLISTED | APPLIED | PROFILE | BROWSE
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}

interface ApplicationSummary {
  id: Uuid;
  position: string | null;
  entityName: string | null;
  status: string | null;
  stageIndex: number;
  isExited: boolean;
}

interface UpcomingItem {
  type: string;
  title: string | null;
  subtitle: string | null;
  at: string | null;
}

interface ActivityItem {
  text: string | null;
  at: string | null;
}

interface EngagementSummary {
  applicationId: Uuid | null;
  status: string | null;
  finalStageLabel: string | null;
  finalStageState: 'current' | 'completed' | 'blocked' | null;
  onboardingTotal: number;
  onboardingCompleted: number;
}

interface CandidateDashboardResponse {
  candidateName: string | null;
  profileComplete: number;
  nextStep: NextStep | null;
  applications: ApplicationSummary[] | null;
  upcoming: UpcomingItem[] | null;
  recentActivity: ActivityItem[] | null;
  engagement: EngagementSummary | null;
}

export default function CandidateDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="Dashboard">
        <CandidateDashboardBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function CandidateDashboardBody() {
  const { user } = useAuth();
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<CandidateDashboardResponse>(
        '/api/v1/candidate/dashboard',
      );
      setData(res.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your dashboard.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (data === null) {
    return <DashboardSkeleton />;
  }

  const apps = data.applications ?? [];
  const upcoming = data.upcoming ?? [];
  const activity = data.recentActivity ?? [];
  const profilePct = data.profileComplete ?? 0;
  const showProfileNudge = profilePct < 100;

  return (
    <section className="space-y-6">
      {/* Welcome header */}
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Welcome back{data.candidateName ? `, ${data.candidateName}` : ''}.
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {apps.length} active application{apps.length === 1 ? '' : 's'} · profile{' '}
              {profilePct}% complete
            </p>
          </div>
          {user?.applicantId && (
            <div
              className="rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-medium text-accent-dark"
              title="Your Skyzen Applicant ID"
            >
              ID: {user.applicantId}
            </div>
          )}
        </div>
      </header>

      {/* Next-step hero */}
      {data.nextStep && <NextStepHero step={data.nextStep} />}

      {/* Two-column layout (stacks on mobile) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Applications — wider column */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Your applications</h2>
            {apps.length > 0 && (
              <Link
                href="/careers/candidate/applications"
                className="text-xs font-medium text-accent hover:underline"
              >
                View all
              </Link>
            )}
          </div>
          {apps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
              <Briefcase
                className="mx-auto mb-3 h-8 w-8 text-gray-400"
                strokeWidth={1.5}
              />
              <p className="mb-3 text-sm text-gray-600">No applications yet.</p>
              <Link
                href="/careers/openings"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
              >
                Browse open internships
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {apps.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-gray-200 bg-white p-5"
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-900">
                        {a.position ?? '—'}
                      </div>
                      <div className="truncate text-sm text-gray-600">
                        {a.entityName ?? '—'}
                      </div>
                    </div>
                    {a.status ? <ApplicationStatusBadge status={a.status} /> : null}
                  </div>
                  <StatusStepper
                    currentIndex={a.stageIndex}
                    isExited={a.isExited}
                    size="mini"
                    finalLabel={
                      data.engagement
                      && data.engagement.applicationId === a.id
                        ? data.engagement.finalStageLabel
                        : null
                    }
                    finalState={
                      data.engagement
                      && data.engagement.applicationId === a.id
                        ? data.engagement.finalStageState
                        : null
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right column: Upcoming + Recent activity */}
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Upcoming</h2>
            {upcoming.length === 0 && !showProfileNudge ? (
              <p className="text-sm text-gray-500">Nothing on the calendar.</p>
            ) : (
              <ul className="space-y-3">
                {showProfileNudge && (
                  <li>
                    <Link
                      href="/careers/candidate/profile"
                      className="-mx-2 flex items-start gap-3 rounded-md p-2 hover:bg-gray-50"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                        <UserCircle className="h-4 w-4" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          Finish your profile
                        </div>
                        <div className="text-xs text-gray-500">{profilePct}% complete</div>
                      </div>
                    </Link>
                  </li>
                )}
                {upcoming.map((u, i) => (
                  <li key={`${u.type}-${i}`} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                      <UpcomingIcon type={u.type} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {u.title ?? '—'}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {u.at ? formatRelative(u.at) : '—'}
                        {u.subtitle ? ` · ${u.subtitle}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-gray-500">No recent activity.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900">{a.text ?? '—'}</div>
                      <div className="text-xs text-gray-500">
                        {a.at ? formatRelative(a.at) : '—'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

function NextStepHero({ step }: { step: NextStep }) {
  // OFFER is the only urgent (amber) variant. Everything else uses the info
  // (accent) tint per the mockup.
  const urgent = step.type === 'OFFER';

  const wrapClasses = urgent
    ? 'rounded-xl border border-amber-300 bg-amber-50 p-6'
    : 'rounded-xl border border-accent/30 bg-accent/5 p-6';
  const iconWrap = urgent
    ? 'bg-amber-200 text-amber-800'
    : 'bg-accent text-white';
  const ctaClasses = urgent
    ? 'inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600'
    : 'inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90';

  return (
    <div className={wrapClasses}>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconWrap}`}
        >
          <NextStepIcon type={step.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-gray-900">
            {step.title ?? 'Next step'}
          </div>
          {step.subtitle && (
            <div className="text-sm text-gray-700">{step.subtitle}</div>
          )}
        </div>
        {step.ctaLabel && step.ctaHref && (
          <Link href={step.ctaHref} className={ctaClasses}>
            {step.ctaLabel}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        )}
      </div>
    </div>
  );
}

function NextStepIcon({ type }: { type: string }) {
  const cn = 'h-5 w-5';
  switch (type) {
    case 'OFFER':
      return <FileSignature className={cn} strokeWidth={2} />;
    case 'INTERVIEW':
      return <CalendarClock className={cn} strokeWidth={2} />;
    case 'ONBOARDING':
    case 'WORK':
    case 'SCREENING':
      return <ClipboardList className={cn} strokeWidth={2} />;
    case 'SELECTED_CONDITIONAL':
      return <BadgeCheck className={cn} strokeWidth={2} />;
    case 'PROFILE':
      return <UserCircle className={cn} strokeWidth={2} />;
    case 'BROWSE':
      return <Briefcase className={cn} strokeWidth={2} />;
    default:
      return <Sparkles className={cn} strokeWidth={2} />;
  }
}

function UpcomingIcon({ type }: { type: string }) {
  const cn = 'h-3.5 w-3.5';
  switch (type) {
    case 'INTERVIEW':
    case 'EVALUATION':
      return <CalendarClock className={cn} strokeWidth={2} />;
    case 'OFFER_EXPIRY':
      return <FileSignature className={cn} strokeWidth={2} />;
    case 'ONBOARDING_DUE':
      return <ClipboardList className={cn} strokeWidth={2} />;
    default:
      return <Clock className={cn} strokeWidth={2} />;
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="h-24 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="h-32 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
          <div className="h-32 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
        </div>
        <div className="space-y-6">
          <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
          <div className="h-40 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
        </div>
      </div>
    </div>
  );
}
