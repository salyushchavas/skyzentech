'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Lock,
  MapPin,
  Search,
} from 'lucide-react';
import api from '@/lib/api';
import InternPageShell from '@/components/intern/InternPageShell';
import { useInternDashboard } from '@/components/intern/InternDashboardContext';
import ApplyModal from '@/components/jobs/ApplyModal';
import type {
  EmploymentType,
  JobPostingResponse,
  Page,
} from '@/types';

type JobTab = 'INTERNSHIP' | 'FULL_TIME';

export default function InternJobsPage() {
  const { data: dashboard, refresh } = useInternDashboard();
  const [tab, setTab] = useState<JobTab>('INTERNSHIP');
  const [search, setSearch] = useState('');
  const [postings, setPostings] = useState<JobPostingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<JobPostingResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Page<JobPostingResponse>>(
        '/api/v1/jobs?page=0&size=50',
      );
      setPostings(res.data.content ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load job postings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return postings
      .filter((p) => (p.employmentType as EmploymentType) === tab)
      .filter((p) => {
        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q)
          || (p.description ?? '').toLowerCase().includes(q)
          || (p.location ?? '').toLowerCase().includes(q)
        );
      });
  }, [postings, tab, search]);

  const emailVerified = dashboard?.emailVerified ?? false;
  const lifecycle = dashboard?.lifecycleStatus;
  const canApply = emailVerified
    && (lifecycle === 'EMAIL_VERIFIED' || lifecycle === 'APPLICATION_SUBMITTED');

  function handleApplied() {
    setApplyTarget(null);
    void load();
    void refresh();
  }

  return (
    <InternPageShell title="Job Postings" subtitle="Browse open roles and apply.">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Job type" className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <TabButton active={tab === 'INTERNSHIP'} onClick={() => setTab('INTERNSHIP')}>
            Internships
          </TabButton>
          <TabButton active={tab === 'FULL_TIME'} onClick={() => setTab('FULL_TIME')}>
            Full-time
          </TabButton>
        </div>
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400" strokeWidth={2} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, location…"
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-64"
          />
        </label>
      </div>

      {!emailVerified && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Verify your email to apply for any role. Open Home for a one-tap resend.
        </div>
      )}
      {emailVerified && !canApply && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Browsing only — your journey has moved past the application phase.
        </div>
      )}

      {loading && <SkeletonGrid />}
      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No {tab === 'INTERNSHIP' ? 'internship' : 'full-time'} postings open right now.
        </p>
      )}
      {!loading && filtered.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <JobCard
              key={p.id}
              posting={p}
              canApply={canApply}
              emailVerified={emailVerified}
              onApply={() => setApplyTarget(p)}
            />
          ))}
        </ul>
      )}

      {applyTarget && (
        <ApplyModal
          posting={applyTarget}
          onClose={() => setApplyTarget(null)}
          onApplied={handleApplied}
        />
      )}
    </InternPageShell>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'rounded-md px-4 py-1.5 text-sm font-medium transition-colors '
        + (active
          ? 'bg-teal-700 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100')
      }
    >
      {children}
    </button>
  );
}

function JobCard({
  posting,
  canApply,
  emailVerified,
  onApply,
}: {
  posting: JobPostingResponse;
  canApply: boolean;
  emailVerified: boolean;
  onApply: () => void;
}) {
  const alreadyApplied = Boolean(posting.applied);
  return (
    <li className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Briefcase className="h-4 w-4" strokeWidth={2} />
          <span className="text-xs font-semibold uppercase tracking-wide">
            {posting.employmentType === 'INTERNSHIP' ? 'Internship' : 'Full-time'}
          </span>
        </div>
        {alreadyApplied && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
            Applied
          </span>
        )}
      </div>
      <h3 className="line-clamp-2 text-base font-semibold text-slate-900">
        {posting.title}
      </h3>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
        {posting.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" strokeWidth={2} />
            {posting.location}
          </span>
        )}
        {posting.entityName && (
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3 w-3" strokeWidth={2} />
            {posting.entityName}
          </span>
        )}
      </div>
      {posting.description && (
        <p className="mt-3 line-clamp-3 text-sm text-slate-600">
          {posting.description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        {alreadyApplied ? (
          <span className="text-xs text-slate-500">
            Track this on My Applications
          </span>
        ) : !emailVerified ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
            <Lock className="h-3 w-3" />
            Verify your email to apply
          </span>
        ) : !canApply ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Lock className="h-3 w-3" />
            Not eligible at this stage
          </span>
        ) : (
          <span className="text-xs text-slate-500">Ready to apply?</span>
        )}
        <button
          type="button"
          disabled={alreadyApplied || !canApply}
          onClick={onApply}
          className={
            'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors '
            + (alreadyApplied || !canApply
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-teal-700 text-white hover:bg-teal-800')
          }
        >
          {alreadyApplied ? 'Applied' : 'Apply Now'}
        </button>
      </div>
    </li>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-48 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
          aria-hidden
        />
      ))}
    </ul>
  );
}
