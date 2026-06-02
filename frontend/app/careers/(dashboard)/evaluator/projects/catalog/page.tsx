'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Plus,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatRelative } from '@/lib/format-date';
import type { Uuid } from '@/types';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

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
  updatedAt?: string;
}

const DIFFICULTY_PILL: Record<Difficulty, string> = {
  EASY: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-sky-100 text-sky-800',
  HARD: 'bg-amber-100 text-amber-800',
  EXPERT: 'bg-rose-100 text-rose-800',
};

export default function ProjectCatalogPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_SUPERVISOR', 'SUPER_ADMIN']}>
      <DashboardLayout title="Project Catalog">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const router = useRouter();
  const [projects, setProjects] = useState<CatalogProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<CatalogProject[]>(
        '/api/v1/projects/catalog',
      );
      setProjects(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the catalog.");
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Project Catalog</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create reusable projects and assign each one to one or more interns.
            The catalog is the template; assignments are the per-intern link
            with their own date, due date, and notes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create project
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {projects === null ? (
        <Skeleton />
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No catalog projects yet. Click <b>Create project</b> to add the first
          one.
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/careers/evaluator/projects/catalog/${p.id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-accent-dark hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.difficulty && (
                      <span
                        className={
                          'inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide '
                          + DIFFICULTY_PILL[p.difficulty]
                        }
                      >
                        {p.difficulty}
                      </span>
                    )}
                  </div>
                  {p.techStack && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.techStack
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((token) => (
                          <span
                            key={token}
                            className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700"
                          >
                            {token}
                          </span>
                        ))}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    {p.createdBy?.fullName && (
                      <>by {p.createdBy.fullName}</>
                    )}
                    {p.createdAt && (
                      <> · created {formatRelative(p.createdAt)}</>
                    )}
                    {typeof p.assignmentCount === 'number' && (
                      <>
                        {' · '}
                        {p.assignmentCount} assignment
                        {p.assignmentCount === 1 ? '' : 's'}
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/careers/evaluator/projects/catalog/${p.id}`)
                  }
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setShowCreate(false);
            toast.success('Project created.');
            router.push(`/careers/evaluator/projects/catalog/${p.id}`);
          }}
        />
      )}
    </section>
  );
}

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: CatalogProject) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [expectedDurationDays, setExpectedDurationDays] = useState<string>('');
  const [deliverables, setDeliverables] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [instructions, setInstructions] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<CatalogProject>(
        '/api/v1/projects/catalog',
        {
          name: name.trim(),
          description: description || undefined,
          techStack: techStack || undefined,
          expectedDurationDays:
            expectedDurationDays.trim().length > 0
              ? Number(expectedDurationDays)
              : undefined,
          deliverables: deliverables || undefined,
          difficulty: difficulty || undefined,
          instructions: instructions || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      );
      onCreated(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ?? "Couldn't create the project.",
      );
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
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900">Create project</h3>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <Field label="Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tech stack">
              <input
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                placeholder="React, Spring Boot, PostgreSQL"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>
            <Field label="Difficulty">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty | '')}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">—</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
                <option value="EXPERT">Expert</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expected duration (days)">
              <input
                type="number"
                min={0}
                value={expectedDurationDays}
                onChange={(e) => setExpectedDurationDays(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>
            <Field label="Start date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>
          </div>
          <Field label="End date">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Field>
          <Field label="Deliverables">
            <textarea
              rows={3}
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Field>
          <Field label="Instructions">
            <textarea
              rows={5}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Field>
          {error && <p className="text-sm text-red-700">{error}</p>}
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
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            {submitting ? 'Creating…' : 'Create'}
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
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
