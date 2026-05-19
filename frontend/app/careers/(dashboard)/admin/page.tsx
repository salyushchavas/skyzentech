'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

export default function AdminDashboard() {
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
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Admin</h1>
      <p className="mb-6 text-sm text-slate-600">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Users" body="Manage staff and candidate accounts." />
        <Card title="Entities" body="Manage staffing entities." />
        <Card title="Job postings" body="Review and publish job postings." />
      </div>
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-medium text-slate-900">End-to-end check</h2>
        <p className="mb-4 text-sm text-slate-600">
          Calls <code className="rounded bg-slate-100 px-1">GET /admin/test</code> on the backend
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
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-2 font-medium text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">{body}</p>
    </div>
  );
}
