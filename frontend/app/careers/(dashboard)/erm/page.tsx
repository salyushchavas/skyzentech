'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function ErmDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">ERM</h1>
      <p className="mb-6 text-sm text-slate-600">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <LinkCard
          href="/careers/recruiter"
          title="Application pipeline"
          body="Recruitment funnel across all postings — drag candidates between stages."
          accent
        />
        <Card title="Scheduled interviews" body="Upcoming interviews you own." />
        <Card title="Job postings" body="Postings under your staffing entity." />
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
          : 'border-slate-200 bg-white hover:border-slate-300')
      }
    >
      <h3 className="mb-2 font-semibold text-slate-900 group-hover:text-primary-800">
        {title} <span className="text-primary-700">&rarr;</span>
      </h3>
      <p className="text-sm text-slate-600">{body}</p>
    </Link>
  );
}
