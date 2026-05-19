'use client';

import { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['ADMIN']}>
      <DashboardLayout title="Admin Dashboard">
        <AdminBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function AdminBody() {
  const { user } = useAuth();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

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

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </h2>
      <p className="mb-6 text-sm text-gray-600">
        System administration — postings, users, entities, and the recruitment funnel.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <LinkCard
          href="/careers/recruiter"
          title="Application pipeline"
          body="Drag-drop Kanban view of all candidate applications across postings."
          accent
        />
        <Card title="Users" body="Manage staff and candidate accounts." />
        <Card title="Entities" body="Manage staffing entities." />
        <Card title="Job postings" body="Review and publish job postings." />
      </div>
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
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

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-2 font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}

function LinkCard({
  href,
  title,
  body,
  accent = false,
}: {
  href: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        'group block rounded-lg border p-5 transition hover:-translate-y-0.5 hover:shadow-md ' +
        (accent
          ? 'border-accent/30 bg-accent/5 hover:border-accent/60'
          : 'border-gray-200 bg-white hover:border-gray-300')
      }
    >
      <h3 className="mb-2 font-semibold text-gray-900 group-hover:text-primary-800">
        {title} <span className="text-primary-700">&rarr;</span>
      </h3>
      <p className="text-sm text-gray-600">{body}</p>
    </Link>
  );
}
