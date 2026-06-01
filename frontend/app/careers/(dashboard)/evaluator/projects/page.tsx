'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Lock,
  Plus,
  RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  CreateProjectRequest,
  ProjectResponse,
  ProjectStatus,
  ReviewOutcome,
  ReviewProjectRequest,
  Uuid,
  WorkspaceSubmission,
} from '@/types';

/**
 * Supervisor project workspace — allocate, board, review.
 *
 * Backed by /api/v1/projects (create / update / list / return / complete).
 * Service-layer scope: only THIS supervisor's interns. SUPER_ADMIN bypasses.
 */
export default function SupervisorProjectsPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_SUPERVISOR', 'SUPER_ADMIN']}>
      <DashboardLayout title="Projects">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

interface InternRow {
  candidateId: Uuid;
  name: string;
  position: string | null;
  entityName: string | null;
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

const STATUS_ORDER: ProjectStatus[] = [
  'SUBMITTED',
  'TECH_APPROVED',
  'PENDING_VIVA',
  'RETURNED',
  'IN_PROGRESS',
  'NOT_STARTED',
  'COMPLETED',
];

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
  const [projects, setProjects] = useState<ProjectResponse[] | null>(null);
  const [interns, setInterns] = useState<InternRow[]>([]);
  const [showAllocate, setShowAllocate] = useState(false);
  const [reviewing, setReviewing] = useState<ProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ProjectResponse[]>('/api/v1/projects/published');
      setProjects(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your projects.");
      setProjects([]);
    }
  }, []);

  // Supervised interns list (reused — same endpoint the supervisor dashboard uses).
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<InternRow[]>('/api/v1/supervised/evaluator/interns');
        setInterns(res.data ?? []);
      } catch {
        setInterns([]);
      }
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const grouped = useMemo(() => {
    const map = new Map<ProjectStatus, ProjectResponse[]>();
    for (const status of STATUS_ORDER) map.set(status, []);
    for (const p of projects ?? []) {
      (map.get(p.status) ?? []).push(p);
    }
    return map;
  }, [projects]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-600">
            Allocate a project to your interns, review submissions, and mark them
            completed when done.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAllocate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Allocate project
        </button>
      </header>

      {toast && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {showAllocate && (
        <AllocateProjectModal
          interns={interns}
          onClose={() => setShowAllocate(false)}
          onCreated={() => {
            setShowAllocate(false);
            setToast('Project allocated.');
            void load();
          }}
        />
      )}

      {reviewing && (
        <ReviewProjectModal
          project={reviewing}
          onClose={() => setReviewing(null)}
          onReviewed={(msg) => {
            setReviewing(null);
            setToast(msg);
            void load();
          }}
        />
      )}

      {projects === null ? (
        <Skeleton />
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No projects allocated yet. Click "Allocate project" to assign your first one.
        </div>
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.map((status) => {
            const rows = grouped.get(status) ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={status}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={
                      'inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                      STATUS_PILL[status]
                    }
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="text-xs text-gray-500">{rows.length}</span>
                </div>
                <ul className="space-y-2">
                  {rows.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
                    >
                      <ProjectRow
                        project={p}
                        onReview={() => setReviewing(p)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProjectRow({
  project,
  onReview,
}: {
  project: ProjectResponse;
  onReview: () => void;
}) {
  const canReview =
    project.status === 'SUBMITTED' || project.status === 'RETURNED';
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{project.title}</h3>
            {project.status === 'COMPLETED' && (
              <Lock className="h-3.5 w-3.5 text-emerald-700" strokeWidth={2} />
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {project.internName ?? '—'}
            {project.dueDate && (
              <span> · due {formatDateOnly(project.dueDate)}</span>
            )}
            {project.submittedAt && (
              <span> · last submission {formatRelative(project.submittedAt)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">
            {project.progressPct}%
          </span>
          {canReview ? (
            <button
              type="button"
              onClick={onReview}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Open review
            </button>
          ) : (
            <button
              type="button"
              onClick={onReview}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Open
            </button>
          )}
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
        <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
          <span className="font-semibold">Your last note: </span>
          {project.reviewNotes}
        </div>
      )}
    </div>
  );
}

// ── Allocate modal ──────────────────────────────────────────────────────────

function AllocateProjectModal({
  interns,
  onClose,
  onCreated,
}: {
  interns: InternRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [candidateId, setCandidateId] = useState<string>(interns[0]?.candidateId ?? '');
  const [description, setDescription] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [resourceLinks, setResourceLinks] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taskTitles, setTaskTitles] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !candidateId) {
      setError('Title and intern are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateProjectRequest = {
        title: title.trim(),
        candidateId,
        description: description || undefined,
        deliverables: deliverables || undefined,
        resourceLinks: parseLines(resourceLinks),
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        taskTitles: parseLines(taskTitles),
      };
      await api.post('/api/v1/projects', body);
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't allocate the project.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="border-b border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900">Allocate project</h3>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <FieldRow label="Intern" required>
            <select
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {interns.length === 0 ? (
                <option value="">No supervised interns</option>
              ) : (
                interns.map((it) => (
                  <option key={it.candidateId} value={it.candidateId}>
                    {it.name}
                    {it.position ? ` — ${it.position}` : ''}
                  </option>
                ))
              )}
            </select>
          </FieldRow>
          <FieldRow label="Title" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </FieldRow>
          <FieldRow label="Description">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context — what is the project about?"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </FieldRow>
          <FieldRow label="Deliverables">
            <textarea
              rows={3}
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              placeholder="What should they produce by the end?"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </FieldRow>
          <FieldRow label="Resource links (one per line)">
            <textarea
              rows={2}
              value={resourceLinks}
              onChange={(e) => setResourceLinks(e.target.value)}
              placeholder="https://repo.example.com/seed-app
https://docs.example.com/spec"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Start date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </FieldRow>
            <FieldRow label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </FieldRow>
          </div>
          <FieldRow label="Initial tasks (one per line)">
            <textarea
              rows={3}
              value={taskTitles}
              onChange={(e) => setTaskTitles(e.target.value)}
              placeholder="Scaffold the repo
Wire the auth flow
Write the README"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </FieldRow>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || interns.length === 0}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {submitting ? 'Allocating…' : 'Allocate'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Review modal ────────────────────────────────────────────────────────────

function ReviewProjectModal({
  project,
  onClose,
  onReviewed,
}: {
  project: ProjectResponse;
  onClose: () => void;
  onReviewed: (toast: string) => void;
}) {
  const [returnNotes, setReturnNotes] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [busy, setBusy] = useState<
    'return' | 'complete' | 'tech-approve' | 'return-revisions'
      | 'mark-pending-viva' | 'complete-after-viva' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [revisionsReason, setRevisionsReason] = useState('');
  const [workspaceSubs, setWorkspaceSubs] = useState<WorkspaceSubmission[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<WorkspaceSubmission[]>(
          `/api/v1/projects/${project.id}/submissions`,
        );
        if (!cancelled) setWorkspaceSubs(res.data ?? []);
      } catch {
        // Workspace submissions are optional context — silently ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id]);
  const canAct = project.status === 'SUBMITTED' || project.status === 'RETURNED';
  const locked = project.status === 'COMPLETED';

  // Two-role workflow gates (the backend enforces them too).
  const canTechApprove = project.status === 'SUBMITTED';
  const canMarkPendingViva = project.status === 'TECH_APPROVED';
  const canCompleteAfterViva =
    project.status === 'PENDING_VIVA' || project.status === 'TECH_APPROVED';
  const canReturnFromReview =
    project.status === 'SUBMITTED'
    || project.status === 'TECH_APPROVED'
    || project.status === 'PENDING_VIVA';
  const latestSubmission = project.submissions?.[0];

  const callReview = async (
    action: 'return' | 'complete',
    body: ReviewProjectRequest,
  ) => {
    setBusy(action);
    setError(null);
    try {
      await api.post(`/api/v1/projects/${project.id}/${action}`, body);
      onReviewed(
        action === 'return' ? 'Returned for changes.' : 'Project completed.',
      );
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't update the project.");
    } finally {
      setBusy(null);
    }
  };

  /**
   * Two-role workflow actions (P1b). Each hits its dedicated endpoint and
   * surfaces backend errors verbatim — the backend's guard messages are
   * cleaner than anything we can synthesise client-side.
   */
  const callWorkflow = async (
    action: 'tech-approve' | 'return-revisions'
      | 'mark-pending-viva' | 'complete-after-viva',
    body?: Record<string, unknown>,
  ) => {
    setBusy(action);
    setError(null);
    try {
      await api.post(`/api/v1/projects/${project.id}/${action}`, body ?? {});
      const toastMsg =
        action === 'tech-approve' ? 'Marked tech-approved.'
          : action === 'return-revisions' ? 'Returned for revisions.'
          : action === 'mark-pending-viva' ? 'Marked pending viva.'
          : 'Completed after viva.';
      onReviewed(toastMsg);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't update the project.");
    } finally {
      setBusy(null);
    }
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
              {project.internName ?? '—'}
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
          {project.tasks.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Checklist ({project.tasks.filter((t) => t.done).length}/{project.tasks.length})
              </div>
              <ul className="space-y-1">
                {project.tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={
                        'inline-flex h-4 w-4 items-center justify-center rounded ' +
                        (t.done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400')
                      }
                    >
                      {t.done && <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />}
                    </span>
                    <span className={t.done ? 'text-gray-500 line-through' : 'text-gray-800'}>
                      {t.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {latestSubmission && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <span>Latest submission</span>
                <span className="font-normal text-gray-500">
                  {formatRelative(latestSubmission.submittedAt)}
                </span>
              </div>
              {latestSubmission.description && (
                <p className="whitespace-pre-wrap text-sm text-gray-800">
                  {latestSubmission.description}
                </p>
              )}
              {latestSubmission.links?.length > 0 && (
                <LinkList label="Links" links={latestSubmission.links} compact />
              )}
            </div>
          )}

          {workspaceSubs.length > 0 && (
            <div className="rounded-md border border-indigo-200 bg-indigo-50/30 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                In-platform submissions
              </div>
              <ul className="space-y-1.5">
                {workspaceSubs.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded border border-indigo-100 bg-white px-2.5 py-1.5"
                  >
                    <div className="min-w-0 text-xs text-gray-800">
                      <span className="font-medium">#{s.submissionNumber}</span>
                      <span className="text-gray-500"> · {formatRelative(s.submittedAt)}</span>
                      {typeof s.fileCount === 'number' && (
                        <span className="text-gray-500">
                          {' '}· {s.fileCount} file{s.fileCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <OutcomePill outcome={s.reviewOutcome} />
                      <Link
                        href={`/careers/submissions/${s.id}`}
                        className="text-xs font-medium text-accent-dark hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {locked ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <Lock className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
              Completed{project.completedAt ? ` ${formatRelative(project.completedAt)}` : ''} —
              locked. Reopen by allocating a follow-up project.
              {project.reviewNotes && (
                <div className="mt-2 text-emerald-800">
                  <span className="font-semibold">Note: </span>
                  {project.reviewNotes}
                </div>
              )}
            </div>
          ) : canAct ? (
            <div className="space-y-3 rounded-md border border-gray-200 bg-white p-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Return with notes (required for return)
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="What needs to change before completion?"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void callReview('return', { reviewNotes: returnNotes })}
                    disabled={busy !== null || returnNotes.trim().length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-800 hover:bg-orange-50 disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                    {busy === 'return' ? 'Returning…' : 'Return'}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Completion note (optional)
                </label>
                <textarea
                  rows={2}
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Anything to highlight on completion?"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      void callReview('complete', {
                        reviewNotes: completeNotes.trim() || undefined,
                      })
                    }
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                    {busy === 'complete' ? 'Completing…' : 'Mark completed'}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}
            </div>
          ) : (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs italic text-gray-500">
              <AlertCircle className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
              Waiting on the intern — review actions unlock after they submit.
            </div>
          )}

          {/* Two-role workflow actions. Rendered alongside the legacy
              return/complete so reviewers can opt into the new path on
              tech stacks that use it. Backend enforces the role gate;
              the buttons hide when the transition isn't legal from the
              current status. */}
          {(canTechApprove || canMarkPendingViva || canCompleteAfterViva || canReturnFromReview) && (
            <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/40 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Two-role workflow
              </div>
              <div className="flex flex-wrap gap-2">
                {canTechApprove && (
                  <button
                    type="button"
                    onClick={() => void callWorkflow('tech-approve')}
                    disabled={busy !== null}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {busy === 'tech-approve' ? 'Approving…' : 'Approve technically'}
                  </button>
                )}
                {canMarkPendingViva && (
                  <button
                    type="button"
                    onClick={() => void callWorkflow('mark-pending-viva')}
                    disabled={busy !== null}
                    className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    {busy === 'mark-pending-viva' ? 'Marking…' : 'Mark pending viva'}
                  </button>
                )}
                {canCompleteAfterViva && (
                  <button
                    type="button"
                    onClick={() => void callWorkflow('complete-after-viva')}
                    disabled={busy !== null}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {busy === 'complete-after-viva' ? 'Completing…' : 'Complete after viva'}
                  </button>
                )}
              </div>
              {canReturnFromReview && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Return for revisions — reason (required)
                  </label>
                  <textarea
                    rows={2}
                    value={revisionsReason}
                    onChange={(e) => setRevisionsReason(e.target.value)}
                    placeholder="What needs to change before sign-off?"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        void callWorkflow('return-revisions', {
                          reason: revisionsReason.trim(),
                        })
                      }
                      disabled={busy !== null || revisionsReason.trim().length === 0}
                      className="rounded-md border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-800 hover:bg-orange-50 disabled:opacity-60"
                    >
                      {busy === 'return-revisions' ? 'Returning…' : 'Return for revisions'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

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
      {!compact && (
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

function OutcomePill({ outcome }: { outcome: ReviewOutcome }) {
  const palette: Record<ReviewOutcome, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    RETURNED: 'bg-orange-100 text-orange-800',
  };
  const label: Record<ReviewOutcome, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    RETURNED: 'Returned',
  };
  return (
    <span
      className={
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
        palette[outcome]
      }
    >
      {label[outcome]}
    </span>
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
      <div className="h-16 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="h-16 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
      <div className="h-16 animate-pulse rounded-lg border border-gray-100 bg-gray-50" />
    </div>
  );
}
