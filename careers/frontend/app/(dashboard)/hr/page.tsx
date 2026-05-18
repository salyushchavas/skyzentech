'use client';

import { useAuth } from '@/lib/auth-context';

export default function HrDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">HR &amp; Compliance</h1>
      <p className="mb-6 text-sm text-slate-600">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="I-9 pending" body="Form I-9 verifications awaiting completion." />
        <Card title="I-983 reviews" body="Training plans pending HR review." />
        <Card title="E-Verify cases" body="Active and pending E-Verify cases." />
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
