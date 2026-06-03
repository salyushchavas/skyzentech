'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Code,
  ExternalLink,
  Lock,
  PlayCircle,
  Send,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import StageLockedEmpty from '@/components/candidate/StageLockedEmpty';
import { useAuth } from '@/lib/auth-context';
import { Briefcase } from 'lucide-react';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  ProjectResponse,
  ProjectStatus,
  ProjectTaskResponse,
  SubmitProjectRequest,
  UpdateProgressRequest,
} from '@/types';

/**
 * Intern project workspace.
 *
 * Backed by /api/v1/projects (me / start / progress / submit). Server-side
 * gate: INTERN role + ACTIVE engagement. APPLICANT cannot reach this surface.
 */
export default function CandidateProjectsPage() {
  // Both APPLICANT and INTERN can land here. The page itself branches on
  // role: INTERNs see their assignment list, APPLICANTs see a stage-locked
  // empty state explaining what unlocks the page. ProtectedRoute redirects
  // anyone outside this set; the prior INTERN-only gate is what was bouncing
  // pre-hire users (and any user whose role cache hadn't been flipped yet).
  return (
    <ProtectedRoute requiredRoles={['INTERN', 'APPLICANT']}>
      <DashboardLayout title="My Projects">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function ApplicantLockedView() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
        <p className="mt-1 text-sm text-slate-600">
          Where your assigned work lives once your internship is active.
        </p>
      </header>
      <StageLockedEmpty
        icon={Briefcase}
        title="Projects unlock after hiring"
        body="Your Technical Evaluator will assign your first project once HR activates your engagement. Until then, focus on completing your onboarding tasks."
        ctaHref="/careers/candidate/onboarding"
        ctaLabel="Continue onboarding"
      />
    </section>
  );
}

const STATUS_PILL: Record<ProjectStatus, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-sky-100 text-sky-800',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  RETURNED: 'bg-orange-100 text-orange-800',
  TECH_APPROVED: 'bg-indigo-100 text-indigo-800',
  PENDING_VIVA: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Awaiting review',
  RETURNED: 'Returned',
  TECH_APPROVED: 'Tech approved',
  PENDING_VIVA: 'Pending viva',
  COMPLETED: 'Completed',
};

function Body() {
  const { user } = useAuth();
  const isIntern = !!user?.roles?.includes('INTERN');
  // APPLICANTs land here too (post role-gate widening) — show the stage-locked
  // empty state without firing any data fetches. They have no assignments yet.
  if (user && !isIntern) {
    return <ApplicantLockedView />;
  }

  return <InternBody />;
}

function InternBody() {
  const [projects, setProjects] = useState<ProjectResponse[] | null>(null);
  const [needsActiveEngagement, setNeedsActiveEngagement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setNeedsActiveEngagement(false);
    try {
      const res = await api.get<ProjectResponse[]>('/api/v1/projects/me');
      setProjects(res.data ?? []);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setNeedsActiveEngagement(true);
        setProjects(null);
        return;
      }
      setError(err?.response?.data?.error ?? "Couldn't load your projects.");
      setProjects(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const open = openId ? projects?.find((p) => p.id === openId) ?? null : null;

  if (needsActiveEngagement) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-sm text-blue-900">
        <p className="font-medium">Projects open up once your engagement is active.</p>
        <p className="mt-1 text-blue-800">
          Your supervisor will assign work here after onboarding wraps.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">My projects</h1>
        <p className="mt-1 text-sm text-gray-600">
          Track allocated work, submit deliverables, and read feedback.
        </p>
      </header>

      {toast && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {open && (
        <ProjectDetailModal
          project={open}
          onClose={() => setOpenId(null)}
          onChanged={(msg) => {
            setOpenId(null);
            setToast(msg);
            void load();
          }}
        />
      )}

      {projects === null ? (
        <Skeleton />
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No projects allocated yet. Your supervisor will assign one shortly.
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <ProjectListRow project={p} onOpen={() => setOpenId(p.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectListRow({
  project,
  onOpen,
}: {
  project: ProjectResponse;
  onOpen: () => void;
}) {
  const locked = project.status === 'COMPLETED';
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{project.title}</h3>
            <span
              className={
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                STATUS_PILL[project.status]
              }
            >
              {STATUS_LABEL[project.status]}
            </span>
            {locked && <Lock className="h-3.5 w-3.5 text-emerald-700" strokeWidth={2} />}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {project.dueDate && <span>Due {formatDateOnly(project.dueDate)}</span>}
            {project.submittedAt && (
              <span> · last submitted {formatRelative(project.submittedAt)}</span>
            )}
            {project.completedAt && (
              <span> · completed {formatRelative(project.completedAt)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">
            {project.progressPct}%
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {locked ? 'View' : 'Open'}
          </button>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={
            'h-full ' +
            (project.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-accent')
          }
          style={{ width: `${Math.max(0, Math.min(100, project.progressPct))}%` }}
        />
      </div>

      {project.status === 'RETURNED' && project.reviewNotes && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <div>
            <span className="font-semibold">Supervisor returned this for changes: </span>
            {project.reviewNotes}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail modal ────────────────────────────────────────────────────────────

function ProjectDetailModal({
  project,
  onClose,
  onChanged,
}: {
  project: ProjectResponse;
  onClose: () => void;
  onChanged: (toast: string) => void;
}) {
  const [progress, setProgress] = useState<number>(project.progressPct);
  const [tasks, setTasks] = useState<ProjectTaskResponse[]>(project.tasks);
  const [submitNote, setSubmitNote] = useState('');
  const [submitLinks, setSubmitLinks] = useState('');
  const [busy, setBusy] = useState<'start' | 'progress' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = project.status === 'COMPLETED';
  const latestSubmission = project.submissions?.[0];

  const callStart = async () => {
    setBusy('start');
    setError(null);
    try {
      await api.post(`/api/v1/projects/${project.id}/start`);
      onChanged('Project started.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't start the project.");
    } finally {
      setBusy(null);
    }
  };

  const callProgress = async () => {
    setBusy('progress');
    setError(null);
    try {
      const body: UpdateProgressRequest = {
        progressPct: progress,
        taskUpdates: tasks.map((t) => ({ taskId: t.id, done: t.done })),
      };
      await api.put(`/api/v1/projects/${project.id}/progress`, body);
      onChanged('Progress saved.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't save progress.");
    } finally {
      setBusy(null);
    }
  };

  const callSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('submit');
    setError(null);
    try {
      const body: SubmitProjectRequest = {
        description: submitNote || undefined,
        links: parseLines(submitLinks),
      };
      await api.post(`/api/v1/projects/${project.id}/submit`, body);
      onChanged('Submitted for review.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't submit.");
    } finally {
      setBusy(null);
    }
  };

  const toggleTask = (taskId: string, done: boolean) => {
    setTasks((curr) => curr.map((t) => (t.id === taskId ? { ...t, done } : t)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Assigned by {project.assignedByName ?? '—'}
              {project.dueDate && <> · due {formatDateOnly(project.dueDate)}</>}
            </p>
          </div>
          <span
            className={
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
              STATUS_PILL[project.status]
            }
          >
            {STATUS_LABEL[project.status]}
          </span>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {project.description && (
            <FieldBlock label="Description" value={project.description} />
          )}
          {project.deliverables && (
            <FieldBlock label="Deliverables" value={project.deliverables} />
          )}
          {project.resourceLinks.length > 0 && (
            <LinkList label="Resources" links={project.resourceLinks} />
          )}

          {/* Status-conditional supervisor note */}
          {project.status === 'RETURNED' && project.reviewNotes && (
            <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
              <span className="font-semibold">Supervisor said: </span>
              {project.reviewNotes}
            </div>
          )}
          {project.status === 'COMPLETED' && project.reviewNotes && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <span className="font-semibold">Supervisor closed with: </span>
              {project.reviewNotes}
            </div>
          )}

          {/* Progress + checklist */}
          {!locked && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center gap-3">
                <label className="text-xs font-medium text-gray-700">
                  Progress: {progress}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="flex-1"
                  aria-label="Progress"
                />
              </div>
              {tasks.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={(e) => toggleTask(t.id, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                      />
                      <span className={t.done ? 'text-gray-500 line-through' : 'text-gray-800'}>
                        {t.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Link
                  href={`/careers/candidate/projects/${project.id}/workspace`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/5 px-3 py-1.5 text-sm font-medium text-accent-dark hover:bg-accent/10"
                >
                  <Code className="h-3.5 w-3.5" strokeWidth={2} />
                  Open workspace
                </Link>
                {project.status === 'NOT_STARTED' && (
                  <button
                    type="button"
                    onClick={() => void callStart()}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    <PlayCircle className="h-3.5 w-3.5" strokeWidth={2} />
                    {busy === 'start' ? 'Starting…' : 'Start'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void callProgress()}
                  disabled={busy !== null}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {busy === 'progress' ? 'Saving…' : 'Save progress'}
                </button>
              </div>
            </div>
          )}

          {/* Submit form */}
          {!locked && (
            <form
              onSubmit={callSubmit}
              className="rounded-md border border-accent/30 bg-accent/5 p-3"
            >
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-dark">
                {project.status === 'RETURNED' ? 'Resubmit' : 'Submit deliverables'}
              </h4>
              <div className="mb-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  placeholder="What did you build / fix?"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Links (one per line — PR / deploy URL / docs)
                </label>
                <textarea
                  rows={3}
                  value={submitLinks}
                  onChange={(e) => setSubmitLinks(e.target.value)}
                  placeholder="https://github.com/example/repo/pull/12
https://staging.example.com/feature"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={2} />
                  {busy === 'submit' ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>
          )}

          {/* History */}
          {project.submissions.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Submission history
              </div>
              <ul className="space-y-2">
                {project.submissions.map((s) => (
                  <li key={s.id} className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="mb-1 text-[11px] text-gray-500">
                      {formatRelative(s.submittedAt)}
                    </div>
                    {s.description && (
                      <p className="whitespace-pre-wrap text-sm text-gray-800">
                        {s.description}
                      </p>
                    )}
                    {s.links.length > 0 && <LinkList label="" links={s.links} compact />}
                  </li>
                ))}
              </ul>
              {latestSubmission && project.status === 'SUBMITTED' && (
                <p className="mt-2 text-[11px] italic text-gray-500">
                  Awaiting supervisor review.
                </p>
              )}
            </div>
          )}

          {locked && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
              This project is completed and locked.
            </div>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-800">{value}</p>
    </div>
  );
}

function LinkList({
  label,
  links,
  compact,
}: {
  label: string;
  links: string[];
  compact?: boolean;
}) {
  return (
    <div>
      {!compact && label && (
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
      )}
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l} className="flex items-start gap-1.5 text-xs">
            <ExternalLink
              className="mt-0.5 h-3 w-3 shrink-0 text-gray-400"
              strokeWidth={2}
            />
            <a
              href={l}
              target="_blank"
              rel="noreferrer"
              className="break-all text-accent-dark hover:underline"
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function parseLines(raw: string): string[] | undefined {
  if (!raw.trim()) return undefined;
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-20 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="h-20 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
    </div>
  );
}
