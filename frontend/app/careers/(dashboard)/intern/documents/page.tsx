'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Lock, Send, Upload } from 'lucide-react';
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
  const pending = packet.pendingTasks ?? 0;

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

      <SubmitHandoffCard packet={packet} pending={pending}
        onSubmitted={onChanged} />

      <div className="space-y-3">
        {packet.tasks.map((t) => (
          <TaskCard key={t.taskId} task={t} packet={packet} onChanged={onChanged} />
        ))}
      </div>
    </>
  );
}

/**
 * Top-of-page handoff banner. Three visual states:
 *  - tasks still PENDING → disabled Submit + "X document(s) still to upload"
 *  - all uploaded, not yet submitted → enabled Submit
 *  - already submitted (internLocked) → green "Submitted, awaiting ERM
 *    verification" — uploads disabled on every task below.
 *  - packet COMPLETED → green "ERM verified all documents".
 */
function SubmitHandoffCard({
  packet, pending, onSubmitted,
}: {
  packet: InternPacketView;
  pending: number;
  onSubmitted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (pending > 0 || packet.internLocked) return;
    if (!confirm(
      'Submit all documents to ERM for verification?\n\n'
      + 'You won\'t be able to change them while ERM is reviewing. '
      + 'If ERM rejects any document, that document will reopen for '
      + 'you to upload again and re-submit.',
    )) return;
    setSubmitting(true);
    setErr(null);
    try {
      await api.post(`/api/v1/intern/documents/packets/${packet.packetId}/submit`);
      onSubmitted();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (packet.status === 'COMPLETED') {
    return (
      <section className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          ERM has verified all your documents. You&apos;re onboarded.
        </p>
      </section>
    );
  }

  if (packet.internLocked) {
    return (
      <section className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 text-violet-700" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-violet-900">
              Submitted to ERM — awaiting verification
            </p>
            <p className="mt-0.5 text-xs text-violet-800">
              Your uploads are locked while ERM reviews each document.
              If anything needs changes, ERM will reject that document
              and it will reopen for you to upload again.
            </p>
            {packet.internSubmittedAt && (
              <p className="mt-1 text-[11px] text-violet-700">
                Submitted {new Date(packet.internSubmittedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  const enabled = pending === 0 && !submitting;
  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Ready to hand off?
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Once you&apos;ve uploaded every required document, submit the
            full packet to ERM for verification.
          </p>
          {pending > 0 && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              {pending} required document{pending === 1 ? '' : 's'} still need
              to be uploaded before you can submit.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!enabled}
          title={pending > 0
            ? `Upload the remaining ${pending} document(s) first`
            : 'Submit the entire packet to ERM for verification'}
          className={
            'inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors '
            + (enabled
              ? 'bg-brand-700 text-white hover:bg-brand-800'
              : 'cursor-not-allowed bg-slate-200 text-slate-500')
          }
        >
          <Send className="h-3.5 w-3.5" />
          {submitting ? 'Submitting…' : 'Submit all documents to ERM'}
        </button>
      </div>
      {err && (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
          {err}
        </p>
      )}
    </section>
  );
}

function TaskCard({ task, packet, onChanged }: {
  task: InternTaskView;
  packet: InternPacketView;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setErr(null);
    // ERM Phase 8.2 — strict client-side PDF check, mirroring the
    // server gate. Some browsers leave file.type empty for older PDFs,
    // so we also check the filename extension.
    const filename = file.name.toLowerCase();
    const isPdfMime = file.type === 'application/pdf';
    const isPdfName = filename.endsWith('.pdf');
    if (!isPdfMime && !isPdfName) {
      setErr('Only PDF files are accepted. Scan all filled pages into a '
        + 'single PDF using your phone\'s scanner app, then upload that PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr('File exceeds 10 MB limit.');
      return;
    }
    setUploading(true);
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
  // Phase 1.6 — also hide Upload while the packet is locked. The server
  // enforces the same rule (409) so hiding the button here is just UX.
  const canUpload = task.status !== 'ACCEPTED'
    && task.status !== 'WAIVED'
    && !packet.internLocked;

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
          <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
            <strong className="block">How to complete this document:</strong>
            {task.templatePublicUrl ? (
              <span className="mt-1 block">
                1. Download the PDF below.<br />
                2. Print the PDF and fill it out by hand (blue or black pen).<br />
                3. Use your phone&apos;s scanner app (Adobe Scan, Microsoft Lens,
                or your built-in Notes scanner) to scan all filled pages into a
                single PDF.<br />
                4. Upload the scanned PDF here.
              </span>
            ) : (
              // Upload-only doc (Phase E identity / education) — no
              // fill-in template; the intern scans/photos an existing
              // document and uploads.
              <span className="mt-1 block">
                1. Take a clear photo or scan of your existing document
                (use your phone&apos;s scanner app for best results).<br />
                2. If the document has multiple pages, combine them into a
                single PDF using Adobe Scan, Microsoft Lens, or Apple Notes.<br />
                3. Upload the PDF here.
              </span>
            )}
          </p>
          {task.taskInstructions && (
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <strong className="block">Note from your ERM agent:</strong>
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
          {task.templatePublicUrl && (
            <a
              href={task.templatePublicUrl}
              target="_blank"
              rel="noreferrer"
              download
              className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" /> Download template
            </a>
          )}

          {canUpload && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
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
                className="inline-flex items-center justify-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:bg-slate-300"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? 'Uploading…' : task.submittedAt ? 'Replace upload' : 'Upload filled PDF'}
              </button>
              <p className="text-[10px] text-slate-500">PDF only · max 10 MB</p>
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
