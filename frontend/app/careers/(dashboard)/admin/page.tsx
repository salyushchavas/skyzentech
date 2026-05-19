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

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['ADMIN']}>
      <DashboardLayout title="Admin Dashboard">
        <AdminBody />
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

function AdminBody() {
  const { user } = useAuth();
  const [postings, setPostings] = useState<JobPostingResponse[] | null>(null);
  const [applications, setApplications] = useState<ApplicationResponse[] | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

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

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.get<{ message: string }>('/admin/test');
      setTestResult({ ok: true, message: res.data.message });
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Request failed';
      setTestResult({ ok: false, message: msg });
    } finally {
      setTesting(false);
    }
  }

  const openPostings =
    postings === null ? null : postings.filter((p) => p.status === 'OPEN').length;
  const totalApps = applications === null ? null : applications.length;
  const activePipeline =
    applications === null
      ? null
      : applications.filter((a) => !TERMINAL_STATUSES.includes(a.status)).length;
  const hiredCount =
    applications === null
      ? null
      : applications.filter((a) => a.status === 'ACCEPTED').length;

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </h2>
      <p className="mb-6 text-sm text-gray-600">
        System administration — postings, users, entities, and the recruitment funnel.
      </p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open Postings"
          value={openPostings}
          href="/careers/admin/postings"
          descriptor="published & accepting applications"
        />
        <StatCard
          label="Total Applications"
          value={totalApps}
          href="/careers/recruiter"
          descriptor="across all postings"
        />
        <StatCard
          label="Active Pipeline"
          value={activePipeline}
          href="/careers/recruiter"
          descriptor="not yet hired or rejected"
        />
        <StatCard
          label="Hired"
          value={hiredCount}
          descriptor="offers accepted"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-1 text-lg font-medium text-gray-900">End-to-end check</h3>
        <p className="mb-4 text-sm text-gray-600">
          Calls <code className="rounded bg-gray-100 px-1">GET /admin/test</code> on the backend
          with your JWT to confirm RBAC enforcement.
        </p>
        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {testing ? 'Testing…' : 'Test admin endpoint'}
        </button>
        {testResult && (
          <div
            role="status"
            className={
              'mt-3 rounded border p-3 text-sm ' +
              (testResult.ok
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700')
            }
          >
            {testResult.ok ? '✓ ' : '✗ '}
            {testResult.message}
          </div>
        )}
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
