'use client';

import { useAuth } from '@/lib/auth-context';

export default function RecruiterDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Recruiter</h1>
      <p className="mb-6 text-sm text-slate-600">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Review queue" body="New applications waiting on first-pass review." />
        <Card title="Shortlisted candidates" body="Candidates moved forward to interview." />
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
