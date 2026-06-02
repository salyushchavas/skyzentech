'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Github,
  Pencil,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
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

interface RepositoryRef {
  id: Uuid;
  repositoryName: string;
  repositoryUrl: string;
  linkedBy?: { id: Uuid; fullName: string };
  linkedAt?: string;
}

interface CatalogProject {
  id: Uuid;
  name: string;
  description?: string;
  requirements?: string;
  objectives?: string;
  techStack?: string;
  expectedDurationDays?: number;
  deliverables?: string;
  difficulty?: Difficulty;
  instructions?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: { id: Uuid; fullName: string };
  assignmentCount?: number;
  repository?: RepositoryRef;
  createdAt?: string;
}

interface AssignmentRow {
  id: Uuid;
  project: { id: Uuid; name: string };
  intern: { id: Uuid; fullName: string; email: string; githubUsername?: string };
  assignedBy: { id: Uuid; fullName: string };
  accessGrantedBy?: { id: Uuid; fullName: string };
  assignmentDate: string;
  dueDate?: string;
  remarks?: string;
  status: AssignmentStatus;
  accessGranted?: boolean;
  accessGrantedAt?: string;
  startedAt?: string;
  submittedAt?: string;
  submissionNotes?: string;
  createdAt?: string;
}

interface EligibleIntern {
  id: Uuid;
  fullName: string;
  email: string;
  githubUsername?: string;
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

export default function CatalogProjectDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_SUPERVISOR', 'SUPER_ADMIN']}>
      <DashboardLayout title="Project">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id as Uuid | undefined;

  const [project, setProject] = useState<CatalogProject | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showRepo, setShowRepo] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    try {
      const [p, a] = await Promise.all([
        api.get<CatalogProject>(`/api/v1/projects/catalog/${projectId}`),
        api.get<AssignmentRow[]>(
          `/api/v1/project-assignments/by-project/${projectId}`,
        ),
      ]);
      setProject(p.data);
      setAssignments(a.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the project.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAccessGranted(assignmentId: Uuid) {
    try {
      await api.post(`/api/v1/project-assignments/${assignmentId}/access-granted`);
      toast.success('Access marked as granted.');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't update.");
    }
  }

  async function revokeAccessGranted(assignmentId: Uuid) {
    try {
      await api.delete(`/api/v1/project-assignments/${assignmentId}/access-granted`);
      toast.success('Access flag revoked.');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't update.");
    }
  }

  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!project) return <Skeleton />;

  const hasRepo = !!project.repository;

  return (
    <section className="space-y-5">
      <header>
        <button
          type="button"
          onClick={() => router.push('/careers/evaluator/projects/catalog')}
          className="mb-1 text-xs text-gray-500 hover:text-gray-700"
        >
          ← Back to catalog
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
              {project.difficulty && (
                <span
                  className={
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
                    + DIFFICULTY_PILL[project.difficulty]
                  }
                >
                  {project.difficulty}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {project.createdBy?.fullName && <>created by {project.createdBy.fullName}</>}
              {project.createdAt && <> · {formatRelative(project.createdAt)}</>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAssign(true)}
            disabled={!hasRepo}
            title={!hasRepo ? 'Link a repository first.' : 'Assign to one or more interns'}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Assign to interns
          </button>
        </div>
      </header>

      {/* Repository section */}
      <section
        className={
          'rounded-lg border p-5 '
          + (hasRepo ? 'border-gray-200 bg-white' : 'border-amber-200 bg-amber-50/50')
        }
      >
        <div className="mb-2 flex items-center gap-2">
          <Github className="h-4 w-4 text-gray-700" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">Repository</h2>
        </div>
        {hasRepo ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900">
                {project.repository!.repositoryName}
              </div>
              <a
                href={project.repository!.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-xs text-accent-dark hover:underline"
              >
                {project.repository!.repositoryUrl}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={project.repository!.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                Open repository
              </a>
              <button
                type="button"
                onClick={() => setShowRepo(true)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                title="Update repository link"
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
                Edit
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-900">
              Create the repository in GitHub first, then link it here.
              Interns cannot be assigned until a repository is linked.
            </p>
            <button
              type="button"
              onClick={() => setShowRepo(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              <Github className="h-4 w-4" strokeWidth={2} />
              Link GitHub repository
            </button>
          </div>
        )}
      </section>

      {/* Metadata */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 lg:grid-cols-2">
        {project.techStack && (
          <Field label="Tech stack">
            <div className="flex flex-wrap gap-1">
              {project.techStack
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
        {project.expectedDurationDays != null && (
          <Field label="Expected duration">{project.expectedDurationDays} days</Field>
        )}
        {project.startDate && (
          <Field label="Start date">{formatDateOnly(project.startDate)}</Field>
        )}
        {project.endDate && (
          <Field label="End date">{formatDateOnly(project.endDate)}</Field>
        )}
        {project.description && (
          <div className="lg:col-span-2">
            <Field label="Description">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{project.description}</p>
            </Field>
          </div>
        )}
        {project.requirements && (
          <div className="lg:col-span-2">
            <Field label="Requirements">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{project.requirements}</p>
            </Field>
          </div>
        )}
        {project.objectives && (
          <div className="lg:col-span-2">
            <Field label="Objectives">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{project.objectives}</p>
            </Field>
          </div>
        )}
        {project.deliverables && (
          <div className="lg:col-span-2">
            <Field label="Deliverables">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{project.deliverables}</p>
            </Field>
          </div>
        )}
        {project.instructions && (
          <div className="lg:col-span-2">
            <Field label="Instructions">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{project.instructions}</p>
            </Field>
          </div>
        )}
      </div>

      {/* Assignments table */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-gray-900">
            Assignments ({assignments?.length ?? 0})
          </h2>
        </div>
        {assignments === null ? (
          <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
        ) : assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
            No one is assigned to this project yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Intern</th>
                  <th className="px-3 py-2 text-left font-semibold">GitHub</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Access</th>
                  <th className="px-3 py-2 text-left font-semibold">Started</th>
                  <th className="px-3 py-2 text-left font-semibold">Submitted</th>
                  <th className="px-3 py-2 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{a.intern.fullName}</div>
                      <div className="text-xs text-gray-500">{a.intern.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {a.intern.githubUsername ? (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700">
                          @{a.intern.githubUsername}
                        </span>
                      ) : (
                        <span className="text-amber-700">not provided</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
                          + STATUS_PILL[a.status]
                        }
                      >
                        {a.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {a.accessGranted ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                          Granted
                          {a.accessGrantedAt && (
                            <span
                              className="text-gray-500"
                              title={formatFull(a.accessGrantedAt)}
                            >
                              · {formatRelative(a.accessGrantedAt)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {a.startedAt ? formatRelative(a.startedAt) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {a.submittedAt ? formatRelative(a.submittedAt) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {a.accessGranted ? (
                        <button
                          type="button"
                          onClick={() => void revokeAccessGranted(a.id)}
                          className="text-[11px] text-gray-500 hover:text-gray-800 hover:underline"
                          title="Revoke access flag (informational)"
                        >
                          revoke
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void markAccessGranted(a.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                          title="Mark access granted after inviting the intern on GitHub"
                        >
                          <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
                          Mark access granted
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showRepo && projectId && (
        <RepositoryModal
          projectId={projectId}
          initial={project.repository ?? null}
          onClose={() => setShowRepo(false)}
          onSaved={() => {
            setShowRepo(false);
            toast.success('Repository linked.');
            void load();
          }}
        />
      )}

      {showAssign && projectId && (
        <AssignModal
          projectId={projectId}
          onClose={() => setShowAssign(false)}
          onDone={(succeeded, failed) => {
            setShowAssign(false);
            if (succeeded > 0)
              toast.success(`Assigned to ${succeeded} intern${succeeded === 1 ? '' : 's'}.`);
            if (failed > 0)
              toast.error(`${failed} assignment${failed === 1 ? '' : 's'} failed.`);
            void load();
          }}
        />
      )}
    </section>
  );
}

// ── Repository modal (link / update) ──────────────────────────────────────

function RepositoryModal({
  projectId,
  initial,
  onClose,
  onSaved,
}: {
  projectId: Uuid;
  initial: RepositoryRef | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [repositoryName, setRepositoryName] = useState(initial?.repositoryName ?? '');
  const [repositoryUrl, setRepositoryUrl] = useState(initial?.repositoryUrl ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!repositoryName.trim() || !repositoryUrl.trim()) {
      setError('Repository name and URL are required.');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        repositoryName: repositoryName.trim(),
        repositoryUrl: repositoryUrl.trim(),
      };
      if (isEdit) {
        await api.put(`/api/v1/projects/catalog/${projectId}/repository`, body);
      } else {
        await api.post(`/api/v1/projects/catalog/${projectId}/repository`, body);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't save.");
      setSubmitting(false);
    }
  }

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
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Update repository link' : 'Link GitHub repository'}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            The repository belongs to the project for its entire lifecycle.
            All assigned interns push to this same repo.
          </p>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Repository name <span className="text-red-500">*</span>
            </label>
            <input
              value={repositoryName}
              onChange={(e) => setRepositoryName(e.target.value)}
              placeholder="company-org/inventory-management-system"
              required
              maxLength={200}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Repository URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              placeholder="https://github.com/company-org/inventory-management-system"
              required
              maxLength={500}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            <Github className="h-3.5 w-3.5" strokeWidth={2} />
            {submitting ? 'Saving…' : isEdit ? 'Update' : 'Link repository'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Assign modal ─────────────────────────────────────────────────────────

function AssignModal({
  projectId,
  onClose,
  onDone,
}: {
  projectId: Uuid;
  onClose: () => void;
  onDone: (succeeded: number, failed: number) => void;
}) {
  const [eligible, setEligible] = useState<EligibleIntern[] | null>(null);
  const [selected, setSelected] = useState<Set<Uuid>>(new Set());
  const [assignmentDate, setAssignmentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<EligibleIntern[]>(
          '/api/v1/project-assignments/eligible-interns',
        );
        setEligible(res.data ?? []);
      } catch (err: any) {
        setError(err?.response?.data?.error ?? "Couldn't load eligible interns.");
        setEligible([]);
      }
    })();
  }, []);

  function toggle(id: Uuid) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.size === 0) {
      setError('Pick at least one intern.');
      return;
    }
    if (dueDate && dueDate < assignmentDate) {
      setError('Due date must be on or after assignment date.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{
        assignments: Array<{ assignmentId: Uuid }>;
        failures: Array<{ internId: Uuid; reason: string }>;
      }>('/api/v1/project-assignments', {
        projectId,
        internIds: Array.from(selected),
        assignmentDate,
        dueDate: dueDate || undefined,
        remarks: remarks.trim() || undefined,
      });
      onDone(res.data.assignments?.length ?? 0, res.data.failures?.length ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't assign.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="border-b border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900">Assign to interns</h3>
          <p className="mt-1 text-xs text-gray-500">
            Each intern gets their own assignment row. Re-assigning is allowed —
            history is preserved.
          </p>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Interns <span className="text-red-500">*</span>
            </label>
            {eligible === null ? (
              <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
            ) : eligible.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-xs text-gray-600">
                No hired interns available.
              </div>
            ) : (
              <ul className="max-h-56 overflow-y-auto rounded-md border border-gray-200">
                {eligible.map((it) => {
                  const checked = selected.has(it.id);
                  return (
                    <li
                      key={it.id}
                      className={
                        'flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50 '
                        + (checked ? 'bg-accent/5' : '')
                      }
                    >
                      <input
                        id={`int-${it.id}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(it.id)}
                        className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                      />
                      <label
                        htmlFor={`int-${it.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <div className="font-medium text-gray-900">{it.fullName}</div>
                        <div className="text-xs text-gray-500">
                          {it.email}
                          {it.githubUsername ? (
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700">
                              @{it.githubUsername}
                            </span>
                          ) : (
                            <span className="ml-2 text-amber-700">(no GitHub username)</span>
                          )}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-1 text-[11px] text-gray-500">{selected.size} selected</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Assignment date" required>
              <input
                type="date"
                value={assignmentDate}
                onChange={(e) => setAssignmentDate(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>
          </div>

          <Field label="Remarks">
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={2000}
              placeholder="Anything the intern should know about this assignment?"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Field>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            {submitting
              ? 'Assigning…'
              : `Assign ${selected.size} intern${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
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
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-1/3 animate-pulse rounded bg-gray-100" />
      <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
