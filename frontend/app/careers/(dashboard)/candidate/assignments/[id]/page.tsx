'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Clock,
  ExternalLink,
  Github,
  Play,
  Send,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly, formatFull, formatRelative } from '@/lib/format-date';
import type { Uuid } from '@/types';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
type AssignmentStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'TECH_APPROVED'
  | 'PENDING_VIVA'
  | 'COMPLETED';

interface AssignmentDetail {
  id: Uuid;
  project: {
    id: Uuid;
    name: string;
    techStack?: string;
    difficulty?: Difficulty;
    description?: string;
    requirements?: string;
    objectives?: string;
    deliverables?: string;
    instructions?: string;
    expectedDurationDays?: number;
    startDate?: string;
    endDate?: string;
    repository?: { repositoryName: string; repositoryUrl: string };
  };
  intern: { id: Uuid; fullName: string; email: string; githubUsername?: string };
  assignedBy: { id: Uuid; fullName: string };
  assignmentDate: string;
  dueDate?: string;
  remarks?: string;
  status: AssignmentStatus;
  accessGranted?: boolean;
  accessGrantedAt?: string;
  startedAt?: string;
  submittedAt?: string;
  submissionNotes?: string;
}

const DIFFICULTY_PILL: Record<Difficulty, string> = {
  EASY: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-sky-100 text-sky-800',
  HARD: 'bg-amber-100 text-amber-800',
  EXPERT: 'bg-rose-100 text-rose-800',
};

const STATUS_PILL: Record<AssignmentStatus, string> = {
  ASSIGNED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-sky-100 text-sky-800',
  SUBMITTED: 'bg-emerald-100 text-emerald-800',
  RETURNED: 'bg-orange-100 text-orange-800',
  TECH_APPROVED: 'bg-violet-100 text-violet-800',
  PENDING_VIVA: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
};

export default function AssignmentDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['INTERN', 'APPLICANT']}>
      <DashboardLayout title="Assignment">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as Uuid | undefined;
  const auth = useAuth();
  const [a, setA] = useState<AssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'start' | 'submit' | 'github' | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await api.get<AssignmentDetail>(
        `/api/v1/project-assignments/${id}`,
      );
      setA(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the assignment.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveGithubUsername(username: string) {
    if (!username.trim()) return;
    setBusy('github');
    try {
      await api.put('/api/v1/users/me/github-username', {
        githubUsername: username.trim(),
      });
      toast.success('GitHub username saved.');
      await load();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ?? "Couldn't save your GitHub username.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function startProject() {
    if (!id || busy) return;
    setBusy('start');
    try {
      await api.post(`/api/v1/project-assignments/${id}/start`);
      toast.success('Project started.');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't start the project.");
    } finally {
      setBusy(null);
    }
  }

  async function submitProject(notes: string) {
    if (!id || busy) return;
    setBusy('submit');
    try {
      await api.post(`/api/v1/project-assignments/${id}/submit`, {
        submissionNotes: notes.trim() || undefined,
      });
      toast.success('Project submitted.');
      setShowSubmit(false);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't submit.");
    } finally {
      setBusy(null);
    }
  }

  function copyCloneCommand() {
    if (!a?.project.repository) return;
    let url = a.project.repository.repositoryUrl;
    if (!url.endsWith('.git')) url += '.git';
    void navigator.clipboard.writeText(`git clone ${url}`)
      .then(() => toast.success('Clone command copied.'))
      .catch(() => toast.error("Couldn't copy to clipboard."));
  }

  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!a) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-1/3 animate-pulse rounded bg-gray-100" />
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  // Source of truth for githubUsername — prefer the assignment payload's
  // intern row (always fresh after load()), fall back to the auth-context
  // user for first-render.
  const githubUsername =
    a.intern.githubUsername
    ?? (auth.user as any)?.githubUsername
    ?? null;

  const repo = a.project.repository;

  return (
    <section className="space-y-5">
      <header>
        <button
          type="button"
          onClick={() => router.push('/careers/candidate/assignments')}
          className="mb-1 text-xs text-gray-500 hover:text-gray-700"
        >
          ← Back to assignments
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">{a.project.name}</h1>
          {a.project.difficulty && (
            <span
              className={
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
                + DIFFICULTY_PILL[a.project.difficulty]
              }
            >
              {a.project.difficulty}
            </span>
          )}
          <span
            className={
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
              + STATUS_PILL[a.status]
            }
          >
            {a.status.replaceAll('_', ' ')}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          assigned by {a.assignedBy.fullName}
          <> · {formatDateOnly(a.assignmentDate)}</>
          {a.dueDate && <> · due {formatDateOnly(a.dueDate)}</>}
        </p>
      </header>

      {/* Repository block */}
      {repo && (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-2 flex items-center gap-2">
            <Github className="h-4 w-4 text-gray-700" strokeWidth={2} />
            <h2 className="text-sm font-semibold text-gray-900">Repository</h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900">{repo.repositoryName}</div>
              <a
                href={repo.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-xs text-accent-dark hover:underline"
              >
                {repo.repositoryUrl}
              </a>
            </div>
            <a
              href={repo.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              Open repository
            </a>
          </div>
        </section>
      )}

      {/* Action area — branches on status */}
      <ActionArea
        assignment={a}
        githubUsername={githubUsername}
        busy={busy}
        onSaveGithub={saveGithubUsername}
        onStart={startProject}
        onSubmit={() => setShowSubmit(true)}
        onCopyClone={copyCloneCommand}
      />

      {/* Project metadata */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 lg:grid-cols-2">
        {a.project.techStack && (
          <Field label="Tech stack">
            <div className="flex flex-wrap gap-1">
              {a.project.techStack
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700"
                  >
                    {t}
                  </span>
                ))}
            </div>
          </Field>
        )}
        {a.project.expectedDurationDays != null && (
          <Field label="Expected duration">{a.project.expectedDurationDays} days</Field>
        )}
        {a.project.startDate && (
          <Field label="Project start">{formatDateOnly(a.project.startDate)}</Field>
        )}
        {a.project.endDate && (
          <Field label="Project end">{formatDateOnly(a.project.endDate)}</Field>
        )}
        {a.project.description && (
          <div className="lg:col-span-2">
            <Field label="Description">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {a.project.description}
              </p>
            </Field>
          </div>
        )}
        {a.project.requirements && (
          <div className="lg:col-span-2">
            <Field label="Requirements">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {a.project.requirements}
              </p>
            </Field>
          </div>
        )}
        {a.project.objectives && (
          <div className="lg:col-span-2">
            <Field label="Objectives">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {a.project.objectives}
              </p>
            </Field>
          </div>
        )}
        {a.project.deliverables && (
          <div className="lg:col-span-2">
            <Field label="Deliverables">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {a.project.deliverables}
              </p>
            </Field>
          </div>
        )}
        {a.project.instructions && (
          <div className="lg:col-span-2">
            <Field label="Instructions">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {a.project.instructions}
              </p>
            </Field>
          </div>
        )}
        {a.remarks && (
          <div className="lg:col-span-2">
            <Field label="Notes from your evaluator">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{a.remarks}</p>
            </Field>
          </div>
        )}
      </div>

      {showSubmit && (
        <SubmitModal
          submitting={busy === 'submit'}
          onCancel={() => setShowSubmit(false)}
          onSubmit={submitProject}
        />
      )}
    </section>
  );
}

function ActionArea({
  assignment,
  githubUsername,
  busy,
  onSaveGithub,
  onStart,
  onSubmit,
  onCopyClone,
}: {
  assignment: AssignmentDetail;
  githubUsername: string | null;
  busy: 'start' | 'submit' | 'github' | null;
  onSaveGithub: (username: string) => Promise<void>;
  onStart: () => void;
  onSubmit: () => void;
  onCopyClone: () => void;
}) {
  if (assignment.status === 'SUBMITTED') {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-5">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" strokeWidth={2} />
          <div>
            <p className="text-sm font-medium text-emerald-900">
              Submitted{assignment.submittedAt && ` on ${formatFull(assignment.submittedAt)}`}.
              Awaiting Technical Evaluator review.
            </p>
            {assignment.submissionNotes && (
              <p className="mt-2 whitespace-pre-wrap text-xs text-emerald-800">
                <span className="font-semibold">Your notes:</span> {assignment.submissionNotes}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (assignment.status === 'IN_PROGRESS') {
    return (
      <section className="rounded-lg border border-sky-200 bg-sky-50/50 p-5">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-5 w-5 text-sky-700" strokeWidth={2} />
          <div className="flex-1">
            <p className="text-sm font-medium text-sky-900">
              You&apos;re working on this project.
              {assignment.startedAt && (
                <span className="ml-1 font-normal">
                  Started {formatRelative(assignment.startedAt)}.
                </span>
              )}{' '}
              When complete, click Submit project below.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {assignment.project.repository && (
                <a
                  href={assignment.project.repository.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                  Open repository
                </a>
              )}
              <button
                type="button"
                onClick={onSubmit}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
                Submit project
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // status === ASSIGNED
  if (!githubUsername) {
    return <GithubUsernameForm busy={busy === 'github'} onSave={onSaveGithub} />;
  }

  if (!assignment.accessGranted) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" strokeWidth={2} />
          <div>
            <p className="text-sm font-medium text-amber-900">
              Waiting for the Technical Evaluator to grant repository access.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              They will invite you on GitHub
              {assignment.project.repository && (
                <>
                  {' '}at{' '}
                  <a
                    href={assignment.project.repository.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-900"
                  >
                    {assignment.project.repository.repositoryName}
                  </a>
                </>
              )}
              . Check your GitHub notifications for the invite.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-5">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" strokeWidth={2} />
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-900">
            Access granted. Clone the repository to your machine and click
            Start project when you begin working.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopyClone}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            >
              <Clipboard className="h-3.5 w-3.5" strokeWidth={2} />
              Copy clone command
            </button>
            <button
              type="button"
              onClick={onStart}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
            >
              <Play className="h-3.5 w-3.5" strokeWidth={2} />
              Start project
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function GithubUsernameForm({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (username: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setErr('Please enter your GitHub username.');
      return;
    }
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(trimmed)) {
      setErr(
        'Invalid GitHub username. 1-39 alphanumeric characters or hyphens, '
        + 'not starting or ending with a hyphen, no consecutive hyphens.',
      );
      return;
    }
    setErr(null);
    await onSave(trimmed);
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-5"
    >
      <div className="flex items-start gap-2">
        <Github className="mt-0.5 h-5 w-5 text-amber-700" strokeWidth={2} />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            Provide your GitHub username
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Your Technical Evaluator needs this to invite you as a collaborator
            on the project repository.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="abhi-victor"
            disabled={busy}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {err && <p className="text-xs text-red-700">{err}</p>}
    </form>
  );
}

function SubmitModal({
  submitting,
  onCancel,
  onSubmit,
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Submit project?</h2>
        <p className="mt-2 text-xs text-gray-600">
          This marks the project as submitted and notifies your Technical
          Evaluator. Make sure your work is pushed to the repository.
        </p>
        <label className="mt-4 mb-1 block text-xs font-medium text-gray-700">
          Submission notes (optional)
        </label>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={5000}
          placeholder="Anything you want the evaluator to know about your submission?"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(notes)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}
