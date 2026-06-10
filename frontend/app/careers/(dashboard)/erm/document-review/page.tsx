'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import ReviewTaskModal from '@/components/erm/documents/ReviewTaskModal';
import type {
  DocumentTaskListPage,
  DocumentTaskRow,
} from '@/components/erm/documents/types';

export default function DocumentReviewQueuePage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="Document review queue"
          subtitle="Submissions awaiting an accept / reject / resend decision."
        />
        <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-slate-100" />}>
          <Queue />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Queue() {
  const sp = useSearchParams();
  const focus = sp?.get('focus') ?? null;
  const [data, setData] = useState<DocumentTaskListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [openTaskId, setOpenTaskId] = useState<string | null>(focus);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulking, setBulking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DocumentTaskListPage>(
        `/api/v1/erm/document-review/queue?page=${page}&pageSize=25`,
      );
      setData(res.data);
      setErr(null);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkAccept() {
    if (selected.size === 0) return;
    if (!confirm(`Accept ${selected.size} submissions?`)) return;
    setBulking(true);
    try {
      await api.post('/api/v1/erm/document-review/tasks/bulk-review', {
        taskIds: Array.from(selected),
        decision: 'ACCEPT',
      });
      setSelected(new Set());
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      alert(ax.response?.data?.error ?? ax.message ?? 'Failed');
    } finally {
      setBulking(false);
    }
  }

  return (
    <>
      {err && (
        <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {err}
        </p>
      )}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {data ? `${data.totalElements} awaiting review` : ''}
        </p>
        <button
          type="button"
          onClick={bulkAccept}
          disabled={selected.size === 0 || bulking}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:bg-slate-300"
        >
          Bulk-accept {selected.size} selected
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && !data ? (
          <div className="h-48 animate-pulse" />
        ) : !data || data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            The queue is empty.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2"></th>
                <th className="px-3 py-2">Intern</th>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Waiting</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((r) => (
                <QueueRow
                  key={r.taskId}
                  r={r}
                  checked={selected.has(r.taskId)}
                  onToggle={() => toggle(r.taskId)}
                  onOpen={() => setOpenTaskId(r.taskId)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Page {data.page + 1} of {data.totalPages}</span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((x) => Math.max(0, x - 1))}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={data.page + 1 >= data.totalPages}
              onClick={() => setPage((x) => x + 1)}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {openTaskId && (
        <ReviewTaskModal
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onReviewed={() => { setOpenTaskId(null); void load(); }}
        />
      )}
    </>
  );
}

function QueueRow({
  r, checked, onToggle, onOpen,
}: {
  r: DocumentTaskRow;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <tr>
      <td className="px-2 py-2">
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </td>
      <td className="px-3 py-2">
        <p className="text-sm font-medium text-slate-900">{r.internName ?? '—'}</p>
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        {r.templateTitle}
        {r.category && (
          <span className="ml-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
            {r.category}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">
        {Math.round(r.hoursWaiting)}h
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md bg-teal-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-teal-800"
        >
          Review
        </button>
      </td>
    </tr>
  );
}
