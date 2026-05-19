'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ApplicationStatusBadge from '@/components/ApplicationStatusBadge';
import type { ApplicationResponse, ApplicationStatus } from '@/types';

const TERMINAL_STATUSES: ApplicationStatus[] = [
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'COMPLETED',
  'LAPSED',
  'NO_SHOW',
];

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface Props {
  applicationId: string | null;
  onClose: () => void;
  /** Called after any successful PATCH so the parent can update its local Kanban state. */
  onUpdated: (application: ApplicationResponse) => void;
}

export default function ApplicationDetailDrawer({
  applicationId,
  onClose,
  onUpdated,
}: Props) {
  const [app, setApp] = useState<ApplicationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<ApplicationStatus | null>(null);

  const open = applicationId !== null;

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApplicationResponse>(`/api/v1/applications/${applicationId}`);
      setApp(res.data);
      setNotes(res.data.recruiterNotes ?? '');
      setSavedAt(res.data.statusUpdatedAt ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to load application');
      setApp(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (open) {
      void load();
    } else {
      setApp(null);
      setError(null);
      setNotes('');
      setSavedAt(null);
    }
  }, [open, load]);

  // Close drawer on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function downloadResume() {
    if (!app?.resumeId) return;
    try {
      const res = await api.get(`/api/v1/resumes/${app.resumeId}/download`, {
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
      a.download = m?.[1] ?? app.resumeFileName ?? `resume-${app.resumeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Resume download failed');
    }
  }

  async function patchStatus(targetStatus: ApplicationStatus, alsoNotes?: string) {
    if (!app) return;
    setBusyAction(targetStatus);
    try {
      const body: { status: ApplicationStatus; recruiterNotes?: string } = {
        status: targetStatus,
      };
      if (alsoNotes !== undefined) body.recruiterNotes = alsoNotes;
      const res = await api.patch<ApplicationResponse>(
        `/api/v1/applications/${app.id}/status`,
        body
      );
      setApp(res.data);
      setSavedAt(res.data.statusUpdatedAt ?? new Date().toISOString());
      if (alsoNotes !== undefined) setNotes(res.data.recruiterNotes ?? '');
      onUpdated(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Status update failed');
    } finally {
      setBusyAction(null);
    }
  }

  async function saveNotes() {
    if (!app) return;
    setSavingNotes(true);
    try {
      const res = await api.patch<ApplicationResponse>(
        `/api/v1/applications/${app.id}/status`,
        { status: app.status, recruiterNotes: notes }
      );
      setApp(res.data);
      setSavedAt(res.data.statusUpdatedAt ?? new Date().toISOString());
      onUpdated(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Could not save notes');
    } finally {
      setSavingNotes(false);
    }
  }

  function confirmAndPatch(target: ApplicationStatus, prompt: string) {
    if (confirm(prompt)) {
      void patchStatus(target);
    }
  }

  if (!open) return null;

  const isTerminal = app ? TERMINAL_STATUSES.includes(app.status) : false;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close detail panel"
        className="absolute inset-0 bg-slate-900/40 transition-opacity"
      />

      {/* Panel */}
      <div className="relative ml-auto h-full w-full max-w-[480px] overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 id="drawer-title" className="text-base font-semibold text-slate-900">
            Application details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <i className="icofont-close-line text-lg" />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="m-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="mb-2">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {app && !loading && !error && (
          <div className="space-y-6 p-5">
            {/* Candidate */}
            <section>
              <h3 className="text-lg font-semibold text-slate-900">
                {app.candidateName ?? '(unnamed candidate)'}
              </h3>
              {app.candidateEmail && (
                <p className="text-sm text-slate-500">{app.candidateEmail}</p>
              )}
            </section>

            {/* Posting + applied */}
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Position
              </div>
              {app.jobPostingTitle && app.jobPostingId ? (
                <Link
                  href={`/careers/openings/${app.jobPostingId}`}
                  className="text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
                  target="_blank"
                >
                  {app.jobPostingTitle}
                </Link>
              ) : (
                <span className="text-sm text-slate-700">
                  {app.jobPostingTitle ?? '(unlinked posting)'}
                </span>
              )}
              <div className="mt-3 text-xs text-slate-500">
                Applied {formatDate(app.appliedAt)}
              </div>
            </section>

            {/* Status */}
            <section>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Current status
              </div>
              <ApplicationStatusBadge status={app.status} />
            </section>

            {/* Resume */}
            <section>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Resume
              </div>
              {app.resumeId ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    <i className="icofont-file-document mr-1.5 text-primary-700" />
                    {app.resumeFileName ?? `Resume ${app.resumeId.slice(0, 8)}`}
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadResume()}
                    className="ml-2 inline-flex items-center gap-1 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                  >
                    <i className="icofont-download" />
                    Download
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No resume attached.</p>
              )}
            </section>

            {/* Notes */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Recruiter notes
                </div>
                {savedAt && (
                  <span className="text-[11px] text-slate-400">
                    Last updated {formatDateTime(savedAt)}
                  </span>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Add internal notes about this candidate…"
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveNotes()}
                  disabled={savingNotes || notes === (app.recruiterNotes ?? '')}
                  className="rounded bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
                >
                  {savingNotes ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </section>

            {/* Actions */}
            <section>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Status actions
              </div>
              <div className="grid gap-2">
                {app.status === 'INTERVIEW_SCHEDULED' && (
                  <ActionButton
                    label="Mark as Interviewed"
                    busy={busyAction === 'INTERVIEWED'}
                    onClick={() => void patchStatus('INTERVIEWED')}
                  />
                )}
                {app.status === 'OFFERED' && (
                  <ActionButton
                    label="Mark as Hired"
                    variant="primary"
                    busy={busyAction === 'ACCEPTED'}
                    onClick={() => void patchStatus('ACCEPTED')}
                  />
                )}
                {!isTerminal && (
                  <>
                    <ActionButton
                      label="Reject"
                      variant="danger"
                      busy={busyAction === 'REJECTED'}
                      onClick={() =>
                        confirmAndPatch('REJECTED', 'Reject this application?')
                      }
                    />
                    <ActionButton
                      label="Withdraw"
                      variant="muted"
                      busy={busyAction === 'WITHDRAWN'}
                      onClick={() =>
                        confirmAndPatch('WITHDRAWN', 'Mark this application as withdrawn?')
                      }
                    />
                  </>
                )}
                {isTerminal && (
                  <p className="text-xs italic text-slate-500">
                    This application is in a terminal state and can no longer be moved.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy = false,
  variant = 'default',
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'muted';
}) {
  const variants: Record<string, string> = {
    default: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    primary: 'bg-accent text-white hover:bg-accent-dark',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
    muted: 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={
        'w-full rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ' +
        variants[variant]
      }
    >
      {busy ? 'Updating…' : label}
    </button>
  );
}
