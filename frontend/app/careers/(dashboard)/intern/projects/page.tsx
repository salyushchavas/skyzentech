'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Briefcase, CalendarClock, Github, Lock } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import StageLockedEmpty from '@/components/candidate/StageLockedEmpty';
import {
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { formatDateOnly } from '@/lib/format-date';

/**
 * Intern projects list. Reads exclusively from the new module's
 * {@code GET /api/v1/project-assignments/mine} endpoint, which carries
 * nested project metadata + repository link in a single round-trip.
 *
 * <p>Card grid; clicking a card navigates to the assignment-id detail page.
 * Polls every 30s — TE-side mutations (access-granted, etc.) surface
 * without manual refresh.</p>
 *
 * <p>Pre-hire users (APPLICANT) get a stage-locked empty state instead of
 * a redirect — same behaviour as the other cycle pages.</p>
 */
export default function CandidateProjectsPage() {
  return (
    <ProtectedRoute requiredRoles={['INTERN', 'APPLICANT']}>
      <DashboardLayout title="Projects">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

// ── Types — match ProjectAssignmentResponse on the backend ────────────────
interface ProjectRef {
  id: string;
  name: string | null;
  techStack: string | null;
  difficulty: string | null;
  description: string | null;
  requirements: string | null;
  objectives: string | null;
  deliverables: string | null;
  instructions: string | null;
  expectedDurationDays: number | null;
  startDate: string | null;
  endDate: string | null;
  repository: { repositoryName: string | null; repositoryUrl: string | null } | null;
}
interface UserRef {
  id: string;
  fullName: string | null;
  email: string | null;
  githubUsername: string | null;
}
export interface ProjectAssignment {
  id: string;
  project: ProjectRef | null;
  intern: UserRef | null;
  assignedBy: UserRef | null;
  assignmentDate: string;
  dueDate: string | null;
  remarks: string | null;
  status: string;
  accessGranted: boolean | null;
  accessGrantedAt: string | null;
  accessGrantedBy: UserRef | null;
  startedAt: string | null;
  submittedAt: string | null;
  submissionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const POLL_MS = 30_000;

function Body() {
  const { user } = useAuth();
  if (user && !user.roles?.includes('INTERN')) {
    return (
      <section className="space-y-6">
        <PageHeader
          title="Projects"
          subtitle="Allocated work and the repositories you'll deliver in."
        />
        <StageLockedEmpty
          icon={Briefcase}
          title="Projects unlock after hiring"
          body="Your Technical Evaluator will assign your first project once HR activates your engagement."
          ctaHref="/careers/candidate/onboarding"
          ctaLabel="Continue onboarding"
        />
      </section>
    );
  }
  return <InternBody />;
}

function InternBody() {
  const [assignments, setAssignments] = useState<ProjectAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const failsRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ProjectAssignment[]>('/api/v1/project-assignments/mine');
      setAssignments(res.data ?? []);
      setError(null);
      failsRef.current = 0;
      setReconnecting(false);
    } catch (err: any) {
      if (assignments == null) {
        setError(err?.response?.data?.error ?? "Couldn't load your projects.");
      }
      failsRef.current += 1;
      if (failsRef.current >= 2) setReconnecting(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    const start = () => {
      if (intervalRef.current != null) return;
      intervalRef.current = window.setInterval(() => void load(), POLL_MS);
    };
    const stop = () => {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    if (!document.hidden) start();
    const onVis = () => {
      if (document.hidden) stop();
      else {
        void load();
        start();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [load]);

  return (
    <section className="space-y-8">
      <PageHeader
        title="Projects"
        subtitle="Allocated work and your repositories."
        meta={
          reconnecting && assignments != null ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Reconnecting…
            </span>
          ) : null
        }
      />

      {error && assignments == null && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {assignments == null && !error ? (
        <ListSkeleton />
      ) : (assignments ?? []).length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects assigned yet"
          description="Your Technical Evaluator will assign your first project once you're hired. New assignments show up here automatically."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {(assignments ?? []).map((a) => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────

const DIFFICULTY_TONE: Record<string, string> = {
  BEGINNER: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INTERMEDIATE: 'bg-blue-50 text-blue-700 ring-blue-200',
  ADVANCED: 'bg-amber-50 text-amber-800 ring-amber-200',
  EXPERT: 'bg-red-50 text-red-700 ring-red-200',
};

function AssignmentCard({ assignment }: { assignment: ProjectAssignment }) {
  const p = assignment.project;
  const techChips = splitTech(p?.techStack);
  const visibleChips = techChips.slice(0, 5);
  const overflow = Math.max(0, techChips.length - visibleChips.length);
  return (
    <Link
      href={`/careers/candidate/projects/${assignment.id}`}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      <Card variant="interactive" className="flex h-full flex-col gap-3">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {p?.name ?? 'Project unavailable'}
            </h3>
            {p?.difficulty && (
              <span
                className={
                  'mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 '
                  + (DIFFICULTY_TONE[p.difficulty] ?? 'bg-slate-50 text-slate-700 ring-slate-200')
                }
              >
                {p.difficulty.charAt(0) + p.difficulty.slice(1).toLowerCase()}
              </span>
            )}
          </div>
          <StatusPill status={assignment.status} />
        </header>

        {p?.description && (
          <p className="line-clamp-2 text-sm text-slate-600">{p.description}</p>
        )}

        {visibleChips.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {visibleChips.map((t) => (
              <li
                key={t}
                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
              >
                {t}
              </li>
            ))}
            {overflow > 0 && (
              <li className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                +{overflow}
              </li>
            )}
          </ul>
        )}

        <dl className="grid grid-cols-3 gap-3 text-xs text-slate-600">
          <Meta label="Assigned">{formatDateOnly(assignment.assignmentDate) ?? '—'}</Meta>
          <Meta label="Due">{assignment.dueDate ? formatDateOnly(assignment.dueDate) : '—'}</Meta>
          <Meta label="Access">
            {assignment.accessGranted ? (
              <span className="text-emerald-700">Granted</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-800">
                <Lock className="h-3 w-3" strokeWidth={2.5} />
                Pending
              </span>
            )}
          </Meta>
        </dl>

        <footer className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
          {p?.repository?.repositoryName ? (
            <span className="inline-flex items-center gap-1 truncate font-mono text-slate-700">
              <Github className="h-3 w-3 shrink-0" strokeWidth={2} />
              <span className="truncate">{p.repository.repositoryName}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-800">
              <Github className="h-3 w-3" strokeWidth={2} />
              Repo not linked yet
            </span>
          )}
          <span className="font-medium text-brand-700">Open →</span>
        </footer>
      </Card>
    </Link>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{children}</dd>
    </div>
  );
}

function splitTech(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <Skeleton className="mb-3 h-5 w-1/2" />
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="mb-2 h-3 w-3/4" />
          <Skeleton className="h-9 w-full" />
        </Card>
      ))}
    </div>
  );
}
