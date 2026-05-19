'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type {
  ApplicationResponse,
  ApplicationStatus,
  JobPostingResponse,
  Page,
} from '@/types';

export default function ErmDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'ADMIN']}>
      <DashboardLayout title="ERM Dashboard">
        <ErmBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

const TERMINAL_STATUSES: ReadonlyArray<ApplicationStatus> = [
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'COMPLETED',
  'LAPSED',
  'NO_SHOW',
];

function ErmBody() {
  const { user } = useAuth();
  const [postings, setPostings] = useState<JobPostingResponse[] | null>(null);
  const [applications, setApplications] = useState<ApplicationResponse[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          api.get<Page<JobPostingResponse>>(
            '/api/v1/job-postings/admin/all?page=0&size=200'
          ),
          api.get<Page<ApplicationResponse>>('/api/v1/applications?size=500&page=0'),
        ]);
        if (!cancelled) {
          setPostings(pRes.data?.content ?? []);
          setApplications(aRes.data?.content ?? []);
        }
      } catch {
        if (!cancelled) {
          setPostings([]);
          setApplications([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPostings =
    postings === null ? null : postings.filter((p) => p.status === 'OPEN').length;
  const interviewsScheduled =
    applications === null
      ? null
      : applications.filter((a) => a.status === 'INTERVIEW_SCHEDULED').length;
  const offersOpen =
    applications === null
      ? null
      : applications.filter((a) => a.status === 'OFFERED').length;
  const activePipeline =
    applications === null
      ? null
      : applications.filter((a) => !TERMINAL_STATUSES.includes(a.status)).length;

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </h2>
      <p className="mb-6 text-sm text-gray-600">
        Recruitment funnel, interviews, and I-983 training plans.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Interviews Scheduled"
          value={interviewsScheduled}
          href="/careers/erm/interviews"
          descriptor="awaiting interview"
        />
        <StatCard
          label="Active Pipeline"
          value={activePipeline}
          href="/careers/recruiter"
          descriptor="across all postings"
        />
        <StatCard
          label="Offers Out"
          value={offersOpen}
          href="/careers/recruiter"
          descriptor="awaiting candidate response"
        />
        <StatCard
          label="Open Postings"
          value={openPostings}
          descriptor="under your entity"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  descriptor,
}: {
  label: string;
  value: number | null;
  href?: string;
  descriptor?: string;
}) {
  const inner = (
    <>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">
        {value === null ? (
          <span className="inline-block h-7 w-12 animate-pulse rounded bg-gray-200" />
        ) : (
          value
        )}
      </div>
      {descriptor && <div className="mt-1 text-xs text-gray-500">{descriptor}</div>}
    </>
  );

  const className =
    'block rounded-lg border border-gray-200 bg-white p-5 transition-shadow ' +
    (href ? 'hover:shadow-md' : '');

  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
