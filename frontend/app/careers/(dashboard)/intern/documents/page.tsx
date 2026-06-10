'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import api from '@/lib/api';
import InternPageShell from '@/components/intern/InternPageShell';
import type {
  InternPacketView,
  InternTaskView,
  TaskStatus,
} from '@/components/erm/documents/types';

export default function InternDocumentsPage() {
  const [data, setData] = useState<InternPacketView | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<InternPacketView>('/api/v1/intern/documents/packet');
      if (res.status === 204) {
        setEmpty(true);
        setData(null);
      } else {
        setData(res.data);
        setEmpty(false);
      }
      setErr(null);
    } catch (e) {
      const ax = e as { response?: { status?: number; data?: { error?: string } }; message?: string };
      if (ax.response?.status === 204) {
        setEmpty(true);
        setData(null);
      } else {
        setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <InternPageShell
      title="Documents"
      subtitle="Download each template, fill it offline, then upload the completed file."
    >
      {err && (
        <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {err}
        </p>
      )}
      {loading && !data && !empty ? (
        <div className="h-48 animate-pulse rounded-lg bg-slate-50" />
      ) : empty ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No documents have been assigned to you yet. Your ERM agent will assign them
          once your reporting structure is in place.
        </div>
      ) : data ? (
        <PacketView packet={data} onChanged={load} />
      ) : null}
    </InternPageShell>
  );
}

function PacketView({ packet, onChanged }: {
  packet: InternPacketView;
  onChanged: () => void;
}) {
  const total = packet.tasks.length;
  const done = packet.tasks.filter((t) => t.status === 'ACCEPTED' || t.status === 'WAIVED').length;
  const pct = total === 0 ? 0 : Math.round((done * 100) / total);

  return (
    <>
      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Packet progress</p>
            <p className="text-sm font-semibold text-slate-900">{done} of {total} accepted</p>
          </div>
          <span className={
            'rounded-full px-3 py-1 text-xs font-semibold ' +
            (packet.status === 'COMPLETED'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800')
          }>
            {packet.status.replace('_', ' ')}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        {packet.customInstructions && (
          <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">
            {packet.customInstructions}
          </p>
        )}
      </section>

      <div className="space-y-3">
        {packet.tasks.map((t) => (
          <TaskCard key={t.taskId} task={t} onChanged={onChanged} />
        ))}
      </div>
    </>
  );
}

function TaskCard({ task, onChanged }: {
  task: InternTaskView;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    try {
      const res = await api.get<Blob>(
        `/api/v1/intern/documents/tasks/${task.taskId}/download`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = task.templateTitle;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Download failed');
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/api/v1/intern/documents/tasks/${task.taskId}/upload`, fd);
      onChanged();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const showReviewerComments =
    (task.status === 'REJECTED' || task.status === 'RESEND_REQUESTED')
    && task.reviewComments;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{task.templateTitle}</h3>
            <TaskBadge status={task.status} />
          </div>
          {task.description && (
            <p className="mt-1 text-xs text-slate-600">{task.description}</p>
          )}
          {task.taskInstructions && (
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-xs text-slate-700">
              {task.taskInstructions}
            </p>
          )}
          {showReviewerComments && (
            <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              <p className="font-semibold">ERM feedback:</p>
              <p className="mt-1 whitespace-pre-wrap">{task.reviewComments}</p>
            </div>
          )}
          {task.submittedAt && (
            <p className="mt-2 text-[11px] text-slate-500">
              Last submission: {new Date(task.submittedAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            <Download className="h-3.5 w-3.5" /> Download template
          </button>

          {task.status !== 'ACCEPTED' && task.status !== 'WAIVED' && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? 'Uploading…' : task.submittedAt ? 'Replace upload' : 'Upload filled'}
              </button>
            </>
          )}
        </div>
      </div>
      {err && (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
          {err}
        </p>
      )}
    </section>
  );
}

function TaskBadge({ status }: { status: TaskStatus }) {
  const styles: Record<TaskStatus, string> = {
    PENDING: 'bg-slate-100 text-slate-700',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    UNDER_REVIEW: 'bg-amber-100 text-amber-800',
    ACCEPTED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-rose-100 text-rose-800',
    RESEND_REQUESTED: 'bg-orange-100 text-orange-800',
    WAIVED: 'bg-slate-200 text-slate-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
