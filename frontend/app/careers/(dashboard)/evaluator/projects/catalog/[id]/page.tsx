'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  UserPlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
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

interface CatalogProject {
  id: Uuid;
  name: string;
  description?: string;
  techStack?: string;
  expectedDurationDays?: number;
  deliverables?: string;
  difficulty?: Difficulty;
  instructions?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: { id: Uuid; fullName: string };
  assignmentCount?: number;
  createdAt?: string;
}

interface AssignmentRow {
  id: Uuid;
  project: { id: Uuid; name: string };
  intern: { id: Uuid; fullName: string; email: string };
  assignedBy: { id: Uuid; fullName: string };
  assignmentDate: string;
  dueDate?: string;
  notes?: string;
  status: AssignmentStatus;
  createdAt?: string;
}

interface EligibleIntern {
  id: Uuid;
  fullName: string;
  email: string;
  engagementStartDate?: string;
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
  SUBMITTED: 'bg-amber-100 text-amber-800',
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

  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!project) return <Skeleton />;

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
              <h1 className="text-2xl font-semibold text-gray-900">
                {project.name}
              </h1>
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
              {project.createdBy?.fullName && (
                <>created by {project.createdBy.fullName}</>
              )}
              {project.createdAt && <> · {formatRelative(project.createdAt)}</>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAssign(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Assign to interns
          </button>
        </div>
      </header>

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
          <Field label="Expected duration">
            {project.expectedDurationDays} days
          </Field>
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
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {project.description}
              </p>
            </Field>
          </div>
        )}
        {project.deliverables && (
          <div className="lg:col-span-2">
            <Field label="Deliverables">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {project.deliverables}
              </p>
            </Field>
          </div>
        )}
        {project.instructions && (
          <div className="lg:col-span-2">
            <Field label="Instructions">
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {project.instructions}
              </p>
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
                  <th className="px-3 py-2 text-left font-semibold">Assigned by</th>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Due</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">
                        {a.intern.fullName}
                      </div>
                      <div className="text-xs text-gray-500">{a.intern.email}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {a.assignedBy.fullName}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {formatDateOnly(a.assignmentDate)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {a.dueDate ? formatDateOnly(a.dueDate) : '—'}
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
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {a.notes ? (
                        <span className="line-clamp-2">{a.notes}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAssign && projectId && (
        <AssignModal
          projectId={projectId}
          onClose={() => setShowAssign(false)}
          onDone={(succeeded, failed) => {
            setShowAssign(false);
            if (succeeded > 0) toast.success(`Assigned to ${succeeded} intern${succeeded === 1 ? '' : 's'}.`);
            if (failed > 0) toast.error(`${failed} assignment${failed === 1 ? '' : 's'} failed.`);
            void load();
          }}
        />
      )}
    </section>
  );
}

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
  const [notes, setNotes] = useState('');
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
        setError(
          err?.response?.data?.error ?? "Couldn't load eligible interns.",
        );
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
    if (!assignmentDate) {
      setError('Assignment date is required.');
      return;
    }
    if (dueDate && dueDate < assignmentDate) {
      setError('Due date must be on or after assignment date.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{
        assignments: Array<{ assignmentId: Uuid; internId: Uuid; status: string }>;
        failures: Array<{ internId: Uuid; reason: string }>;
      }>('/api/v1/project-assignments', {
        projectId,
        internIds: Array.from(selected),
        assignmentDate,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      });
      const okCount = res.data.assignments?.length ?? 0;
      const failCount = res.data.failures?.length ?? 0;
      if (failCount > 0) {
        const reasons = (res.data.failures ?? [])
          .map((f) => `• ${f.reason}`)
          .join('\n');
        console.warn('Some assignments failed:\n' + reasons);
      }
      onDone(okCount, failCount);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't assign.");
    } finally {
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
          <h3 className="text-lg font-semibold text-gray-900">
            Assign to interns
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Each intern gets their own assignment row. Re-assigning the same
            intern is allowed — history is preserved.
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
                No hired interns available right now.
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
                        <div className="font-medium text-gray-900">
                          {it.fullName}
                        </div>
                        <div className="text-xs text-gray-500">{it.email}</div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-1 text-[11px] text-gray-500">
              {selected.size} selected
            </div>
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

          <Field label="Notes">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            {submitting ? 'Assigning…' : `Assign ${selected.size} intern${selected.size === 1 ? '' : 's'}`}
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
      <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
