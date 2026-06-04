'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Plus, Send, Users } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { formatDateOnly } from '@/lib/format-date';
import type {
  CreateWeeklyMaterialRequest,
  MaterialAcknowledgementResponse,
  WeeklyMaterialResponse,
} from '@/types';

/**
 * Supervisor view: publish new weekly materials and inspect per-intern
 * acknowledgement rosters for ones already released. Phase-2 weekly cycle.
 *
 * Routes:
 *   GET    /api/v1/weekly-materials/published
 *   POST   /api/v1/weekly-materials              (create DRAFT)
 *   POST   /api/v1/weekly-materials/{id}/release
 *   GET    /api/v1/weekly-materials/{id}/acknowledgements
 *
 * Role gate matches the backend: TECHNICAL_EVALUATOR or SUPER_ADMIN.
 */
export default function SupervisorWeeklyMaterialsPage() {
  return (
    <ProtectedRoute requiredRoles={['TRAINER', 'SUPER_ADMIN']}>
      <DashboardLayout title="Weekly Materials">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [materials, setMaterials] = useState<WeeklyMaterialResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedAcksFor, setExpandedAcksFor] = useState<string | null>(null);
  const [acks, setAcks] = useState<Record<string, MaterialAcknowledgementResponse[]>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<WeeklyMaterialResponse[]>(
        '/api/v1/weekly-materials/published'
      );
      setMaterials(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your materials.");
      setMaterials(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function release(id: string) {
    try {
      await api.post(`/api/v1/weekly-materials/${id}/release`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Release failed.');
    }
  }

  async function toggleAcks(materialId: string) {
    if (expandedAcksFor === materialId) {
      setExpandedAcksFor(null);
      return;
    }
    setExpandedAcksFor(materialId);
    if (!acks[materialId]) {
      try {
        const res = await api.get<MaterialAcknowledgementResponse[]>(
          `/api/v1/weekly-materials/${materialId}/acknowledgements`
        );
        setAcks((prev) => ({ ...prev, [materialId]: res.data ?? [] }));
      } catch (err: any) {
        setError(err?.response?.data?.error ?? 'Could not load acknowledgements.');
      }
    }
  }

  if (materials === null && !error) return <LoadingSkeleton />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Publish weekly training materials to all ACTIVE interns (broadcast)
          or to a single engagement.
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-accent to-accent-dark px-4 py-2 text-sm font-medium text-white shadow-glow-accent hover:shadow-glow-accent-lg"
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'New material'}
        </button>
      </div>

      {showForm && (
        <PublishForm
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
          onError={setError}
        />
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {materials && materials.length === 0 ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <BookOpen className="mx-auto h-16 w-16 text-gray-300" strokeWidth={1.5} />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            No materials published yet
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Click <em>New material</em> to draft the first week.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {materials!.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-gray-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Week {m.weekNo} ·{' '}
                    {m.engagementId ? (
                      <span className="text-primary-700">
                        Scoped: {m.scopedToCandidateName ?? 'one engagement'}
                      </span>
                    ) : (
                      <span>Broadcast</span>
                    )}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-gray-900">
                    {m.title}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {m.status === 'DRAFT'
                      ? 'Draft'
                      : `Released ${m.releaseDate ? formatDateOnly(m.releaseDate) : ''}`}
                    {m.dueDate && ` · Due ${formatDateOnly(m.dueDate)}`}
                  </p>
                </div>
                {m.status === 'RELEASED' ? (
                  <button
                    type="button"
                    onClick={() => void toggleAcks(m.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Users className="h-3.5 w-3.5" />
                    {m.acknowledgementCount ?? 0} ack{(m.acknowledgementCount ?? 0) === 1 ? '' : 's'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void release(m.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Release
                  </button>
                )}
              </div>

              {expandedAcksFor === m.id && (
                <AckRoster
                  acks={acks[m.id] ?? null}
                  count={m.acknowledgementCount ?? 0}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AckRoster({
  acks,
  count,
}: {
  acks: MaterialAcknowledgementResponse[] | null;
  count: number;
}) {
  if (acks === null) {
    return (
      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
        Loading roster…
      </div>
    );
  }
  if (acks.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
        No interns have acknowledged this material yet ({count} expected).
      </div>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-gray-100 rounded-md border border-gray-200 bg-gray-50">
      {acks.map((a) => (
        <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
          <div>
            <p className="font-medium text-gray-900">{a.internName ?? 'Intern'}</p>
            {a.internEmail && (
              <p className="text-xs text-gray-500">{a.internEmail}</p>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {formatDateOnly(a.acknowledgedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PublishForm({
  onCreated,
  onError,
}: {
  onCreated: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [weekNo, setWeekNo] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urlsRaw, setUrlsRaw] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    onError('');
    try {
      const resourceUrls = urlsRaw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const body: CreateWeeklyMaterialRequest = {
        weekNo,
        title: title.trim(),
        description: description.trim() || undefined,
        resourceUrls: resourceUrls.length > 0 ? resourceUrls : undefined,
        dueDate: dueDate || undefined,
        engagementId: engagementId.trim() || undefined,
      };
      const res = await api.post<WeeklyMaterialResponse>(
        '/api/v1/weekly-materials',
        body
      );
      setCreatedId(res.data.id);
    } catch (err: any) {
      onError(err?.response?.data?.error ?? 'Create failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function releaseNow() {
    if (!createdId) return;
    setSubmitting(true);
    try {
      await api.post(`/api/v1/weekly-materials/${createdId}/release`);
      await onCreated();
    } catch (err: any) {
      onError(err?.response?.data?.error ?? 'Release failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (createdId) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5">
        <p className="text-sm text-green-900">
          Draft saved. It&apos;s not visible to interns until you release it.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void releaseNow()}
            className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-accent to-accent-dark px-4 py-2 text-sm font-medium text-white shadow-glow-accent hover:shadow-glow-accent-lg disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Release now
          </button>
          <button
            type="button"
            onClick={() => void onCreated()}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Keep as draft
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block font-medium text-gray-700">Week #</span>
          <input
            type="number"
            min={1}
            required
            value={weekNo}
            onChange={(e) => setWeekNo(parseInt(e.target.value, 10) || 1)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-gray-700">Due date (optional)</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="block font-medium text-gray-700">Title</span>
        <input
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Week 1 — Spring Boot fundamentals"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <label className="block text-sm">
        <span className="block font-medium text-gray-700">Description (optional)</span>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What the intern should learn this week."
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <label className="block text-sm">
        <span className="block font-medium text-gray-700">
          Resource URLs (optional, one per line)
        </span>
        <textarea
          rows={3}
          value={urlsRaw}
          onChange={(e) => setUrlsRaw(e.target.value)}
          placeholder={`https://example.com/reading\nhttps://github.com/org/repo`}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <label className="block text-sm">
        <span className="block font-medium text-gray-700">
          Engagement ID (optional — leave blank to broadcast)
        </span>
        <input
          type="text"
          value={engagementId}
          onChange={(e) => setEngagementId(e.target.value)}
          placeholder="UUID — scope to a single intern's engagement"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="rounded-md bg-gradient-to-r from-accent to-accent-dark px-4 py-2 text-sm font-medium text-white shadow-glow-accent hover:shadow-glow-accent-lg disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? 'Saving…' : 'Save draft'}
        </button>
      </div>
    </form>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl space-y-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-gray-200 bg-white p-5"
        >
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-72 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-48 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
