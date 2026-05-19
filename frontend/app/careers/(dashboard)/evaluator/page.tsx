'use client';

import { useAuth } from '@/lib/auth-context';

export default function EvaluatorDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Technical Evaluator</h1>
      <p className="mb-6 text-sm text-slate-600">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="My interns" body="Interns assigned to you for technical evaluation." />
        <Card title="This week's assignments" body="Reviews and evaluations due this week." />
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
