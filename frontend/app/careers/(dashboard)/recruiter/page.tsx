'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ApplicationCard from '@/components/ApplicationCard';
import ApplicationDetailDrawer from '@/components/ApplicationDetailDrawer';
import type {
  ApplicationResponse,
  ApplicationStatus,
  JobPostingResponse,
  Page,
} from '@/types';

export default function RecruiterPipelinePage() {
  return (
    <ProtectedRoute requiredRoles={['RECRUITER', 'ERM', 'ADMIN']}>
      <DashboardLayout title="Application Pipeline">
        <PipelineBoard />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

const PRIMARY_COLUMNS: ReadonlyArray<{ key: ApplicationStatus; label: string }> = [
  { key: 'APPLIED', label: 'Applied' },
  { key: 'SHORTLISTED', label: 'Shortlisted' },
  { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled' },
  { key: 'OFFERED', label: 'Offer Extended' },
  { key: 'ACCEPTED', label: 'Hired' },
];

const ARCHIVED_COLUMNS: ReadonlyArray<{ key: ApplicationStatus; label: string }> = [
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'WITHDRAWN', label: 'Withdrawn' },
];

function PipelineBoard() {
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [postings, setPostings] = useState<JobPostingResponse[]>([]);
  const [postingFilter, setPostingFilter] = useState<string>(''); // empty = all
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Postings list (for filter dropdown)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<Page<JobPostingResponse>>(
          '/api/v1/job-postings/admin/all?page=0&size=200'
        );
        if (!cancelled) setPostings(res.data?.content ?? []);
      } catch {
        if (!cancelled) setPostings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadApplications = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('size', '200');
        params.set('page', '0');
        if (postingFilter) params.set('jobPostingId', postingFilter);
        const res = await api.get<Page<ApplicationResponse>>(
          `/api/v1/applications?${params.toString()}`
        );
        setApplications(res.data?.content ?? []);
      } catch (err: any) {
        setError(err?.response?.data?.error ?? "Couldn't load applications.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [postingFilter]
  );

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const columnsByStatus = useMemo(() => {
    const map = new Map<ApplicationStatus, ApplicationResponse[]>();
    const allCols = [...PRIMARY_COLUMNS, ...ARCHIVED_COLUMNS];
    for (const c of allCols) map.set(c.key, []);
    for (const a of applications) {
      const list = map.get(a.status);
      if (list) list.push(a);
    }
    return map;
  }, [applications]);

  const activeApp = useMemo(
    () => (activeId ? applications.find((a) => a.id === activeId) ?? null : null),
    [activeId, applications]
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    const droppedId = String(e.active.id);
    setActiveId(null);

    if (!e.over) return;
    const targetStatus = String(e.over.id) as ApplicationStatus;
    const app = applications.find((a) => a.id === droppedId);
    if (!app || app.status === targetStatus) return;

    const prevStatus = app.status;
    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => (a.id === droppedId ? { ...a, status: targetStatus } : a))
    );

    try {
      const res = await api.patch<ApplicationResponse>(
        `/api/v1/applications/${droppedId}/status`,
        { status: targetStatus }
      );
      // Sync exact server state
      setApplications((prev) =>
        prev.map((a) => (a.id === droppedId ? res.data : a))
      );
    } catch {
      // Revert
      setApplications((prev) =>
        prev.map((a) => (a.id === droppedId ? { ...a, status: prevStatus } : a))
      );
      showToast("Couldn't update status — try again");
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function downloadResume(resumeId: string) {
    try {
      const res = await api.get(`/api/v1/resumes/${resumeId}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: res.headers['content-type'] || 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers['content-disposition'] ?? '';
      const m = disposition.match(/filename="?([^";]+)"?/);
      a.download = m?.[1] ?? `resume-${resumeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Resume download failed');
    }
  }

  function onDrawerUpdate(updated: ApplicationResponse) {
    setApplications((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
  }

  const visibleColumns = showArchived
    ? [...PRIMARY_COLUMNS, ...ARCHIVED_COLUMNS]
    : PRIMARY_COLUMNS;

  return (
    <div>
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Application Pipeline</h1>
          <p className="mt-1 text-sm text-slate-600">
            Drag candidates between columns to update status. Click a card for details.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="postingFilter"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Job posting
            </label>
            <select
              id="postingFilter"
              value={postingFilter}
              onChange={(e) => setPostingFilter(e.target.value)}
              className="w-64 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All postings</option>
              {postings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Show archived
          </label>
          <button
            type="button"
            onClick={() => void loadApplications(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <i className={`icofont-refresh ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {toast}
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void loadApplications()}
            className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-4">
            {visibleColumns.map((col) => (
              <KanbanColumn
                key={col.key}
                status={col.key}
                label={col.label}
                items={columnsByStatus.get(col.key) ?? []}
                onViewDetails={(id) => setDrawerId(id)}
                onDownloadResume={downloadResume}
              />
            ))}
          </div>

          <DragOverlay>
            {activeApp ? (
              <ApplicationCard
                application={activeApp}
                onViewDetails={() => {}}
                onDownloadResume={() => {}}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <ApplicationDetailDrawer
        applicationId={drawerId}
        onClose={() => setDrawerId(null)}
        onUpdated={onDrawerUpdate}
      />
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  items,
  onViewDetails,
  onDownloadResume,
}: {
  status: ApplicationStatus;
  label: string;
  items: ApplicationResponse[];
  onViewDetails: (id: string) => void;
  onDownloadResume: (resumeId: string) => void | Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={
        'flex w-72 shrink-0 flex-col rounded-lg border bg-slate-50 transition ' +
        (isOver ? 'border-accent/60 bg-accent/5' : 'border-slate-200')
      }
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
          {items.length}
        </span>
      </div>
      <div className="flex max-h-[68vh] flex-col gap-2 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">—</div>
        ) : (
          items.map((a) => (
            <ApplicationCard
              key={a.id}
              application={a}
              onViewDetails={onViewDetails}
              onDownloadResume={onDownloadResume}
            />
          ))
        )}
      </div>
    </div>
  );
}
