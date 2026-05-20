'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, Download, Mail, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ConfirmDialog from '@/components/ConfirmDialog';
import ApplicationStatusBadge from '@/components/ApplicationStatusBadge';
import { formatRelative } from '@/lib/format-date';
import type { ApplicationResponse, ApplicationStatus } from '@/types';

// Statuses that mean the application has already moved past shortlisting.
// Pre-shortlist: APPLIED → SHORTLISTED. Past shortlist or terminal hides the button.
const SHORTLIST_LOCKED: ReadonlyArray<ApplicationStatus> = [
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'OFFERED',
  'ACCEPTED',
  'ONBOARDING',
  'ACTIVE',
  'COMPLETED',
];

export default function RecruiterReviewPage() {
  return (
    <ProtectedRoute requiredRoles={['RECRUITER', 'ERM', 'ADMIN']}>
      <DashboardLayout title="Review applicant">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams();
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : null;

  const [app, setApp] = useState<ApplicationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'shortlist' | 'reject' | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await api.get<ApplicationResponse>(`/api/v1/applications/${id}`);
      setApp(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load this application.");
      setApp(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function shortlist() {
    if (!app || busy) return;
    const previous = app;
    setBusy('shortlist');
    // Optimistic
    setApp({ ...app, status: 'SHORTLISTED' });
    try {
      const res = await api.post<ApplicationResponse>(
        `/api/v1/applications/${app.id}/shortlist`
      );
      setApp(res.data);
      toast.success('Shortlisted ✓');
    } catch (err: any) {
      setApp(previous);
      toast.error(err?.response?.data?.error ?? "Couldn't shortlist.");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!app || busy) return;
    const previous = app;
    setBusy('reject');
    setApp({ ...app, status: 'REJECTED' });
    try {
      const res = await api.post<ApplicationResponse>(
        `/api/v1/applications/${app.id}/reject`
      );
      setApp(res.data);
      toast.success('Application rejected');
    } catch (err: any) {
      setApp(previous);
      toast.error(err?.response?.data?.error ?? "Couldn't reject.");
    } finally {
      setBusy(null);
      setRejectOpen(false);
    }
  }

  if (app === null && !error) return <ReviewSkeleton />;

  if (error && !app) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <Link
          href="/careers/recruiter"
          className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
        >
          Back to pipeline
        </Link>
      </div>
    );
  }

  if (!app) return null;

  const canShortlist = !SHORTLIST_LOCKED.includes(app.status) && app.status !== 'REJECTED'
      && app.status !== 'WITHDRAWN';
  const canReject = app.status !== 'REJECTED';

  return (
    <>
      <Link
        href="/careers/recruiter"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to pipeline
      </Link>

      <div className="max-w-5xl">
        <HeaderCard app={app} />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <ResumePanel app={app} />
          <DecisionPanel
            app={app}
            canShortlist={canShortlist}
            canReject={canReject}
            busy={busy}
            onShortlist={() => void shortlist()}
            onRejectClick={() => setRejectOpen(true)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={reject}
        title="Reject this application?"
        description={`This marks ${app.candidateName ?? "the candidate's"} application as rejected. The action is logged in the audit history.`}
        confirmLabel="Reject"
        variant="danger"
      />
    </>
  );
}

// ── Header card ─────────────────────────────────────────────────────────────

function HeaderCard({ app }: { app: ApplicationResponse }) {
  const initials = (app.candidateName ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-base font-semibold text-accent">
            {initials || '?'}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {app.candidateName ?? '(unnamed candidate)'}
            </h2>
            {app.candidateEmail && (
              <div className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                {app.candidateEmail}
              </div>
            )}
            <div className="mt-1 text-sm text-gray-700">
              {app.jobPostingTitle ?? '(unlinked posting)'}
            </div>
          </div>
        </div>
        <ApplicationStatusBadge status={app.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>Experience: —</span>
        <span className="text-gray-300">·</span>
        <span>Applied {formatRelative(app.appliedAt)}</span>
        <span className="text-gray-300">·</span>
        <span>Location: —</span>
      </div>

      {app.recruiterNotes && (
        <div className="mt-4 rounded-md border-l-2 border-gray-300 bg-gray-50 px-3 py-2 text-xs italic text-gray-700">
          {app.recruiterNotes}
        </div>
      )}
    </div>
  );
}

// ── Resume panel ────────────────────────────────────────────────────────────

function ResumePanel({ app }: { app: ApplicationResponse }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadingBlob, setLoadingBlob] = useState(false);
  const [blobError, setBlobError] = useState<string | null>(null);
  const contentTypeRef = useRef<string>('application/pdf');
  const filenameRef = useRef<string>(app.resumeFileName ?? 'resume.pdf');

  useEffect(() => {
    if (!app.resumeId) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoadingBlob(true);
    setBlobError(null);

    (async () => {
      try {
        const res = await api.get(`/api/v1/resumes/${app.resumeId}/download`, {
          responseType: 'blob',
        });
        if (cancelled) return;
        const ctRaw = res.headers['content-type'];
        const contentType =
          typeof ctRaw === 'string' ? ctRaw : 'application/octet-stream';
        contentTypeRef.current = contentType;

        const cdRaw = res.headers['content-disposition'];
        const cd = typeof cdRaw === 'string' ? cdRaw : '';
        const m = cd.match(/filename="?([^";]+)"?/);
        filenameRef.current =
          m?.[1] ?? app.resumeFileName ?? 'resume.pdf';

        const blob = new Blob([res.data], { type: contentType });
        createdUrl = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(createdUrl);
      } catch (err: any) {
        if (!cancelled) {
          setBlobError(
            err?.response?.data?.error ?? "Couldn't load resume preview."
          );
        }
      } finally {
        if (!cancelled) setLoadingBlob(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [app.resumeId, app.resumeFileName]);

  function handleDownload() {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filenameRef.current;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900">Resume</h3>
        {app.resumeId && blobUrl && (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            Download
          </button>
        )}
      </div>

      {!app.resumeId && (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          No resume uploaded.
        </div>
      )}

      {app.resumeId && loadingBlob && (
        <div className="flex h-[480px] items-center justify-center rounded-md border border-gray-200 bg-gray-50">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-xs text-gray-500">Loading preview…</p>
          </div>
        </div>
      )}

      {app.resumeId && blobError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {blobError}
        </div>
      )}

      {app.resumeId && blobUrl && (
        <iframe
          src={blobUrl}
          title={`Resume: ${filenameRef.current}`}
          className="h-[480px] w-full rounded-md border border-gray-200"
        />
      )}
      {app.resumeFileName && (
        <p className="mt-2 text-xs text-gray-500">
          File: <span className="font-mono">{app.resumeFileName}</span>
        </p>
      )}
    </section>
  );
}

// ── Decision panel ──────────────────────────────────────────────────────────

function DecisionPanel({
  app,
  canShortlist,
  canReject,
  busy,
  onShortlist,
  onRejectClick,
}: {
  app: ApplicationResponse;
  canShortlist: boolean;
  canReject: boolean;
  busy: 'shortlist' | 'reject' | null;
  onShortlist: () => void;
  onRejectClick: () => void;
}) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-semibold text-gray-900">Decision</h3>
        <p className="mt-1 text-xs text-gray-500">
          Current status: <ApplicationStatusBadge status={app.status} />
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onShortlist}
            disabled={!canShortlist || busy !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
          >
            {busy === 'shortlist' ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2} />
            )}
            {app.status === 'SHORTLISTED' ? 'Shortlisted' : 'Shortlist'}
          </button>

          <button
            type="button"
            onClick={onRejectClick}
            disabled={!canReject || busy !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {busy === 'reject' ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
            ) : (
              <X className="h-4 w-4" strokeWidth={2} />
            )}
            {app.status === 'REJECTED' ? 'Rejected' : 'Reject'}
          </button>
        </div>

        {!canShortlist && app.status !== 'REJECTED' && app.status !== 'WITHDRAWN' && (
          <p className="mt-3 text-xs text-gray-500">
            This applicant is already past the shortlist stage.
          </p>
        )}
        {app.status === 'REJECTED' && (
          <p className="mt-3 text-xs text-gray-500">
            This application has been rejected. Use the pipeline to move it
            back to APPLIED if this was a mistake.
          </p>
        )}
      </div>
    </aside>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function ReviewSkeleton() {
  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-[480px] animate-pulse rounded-lg bg-gray-100" />
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
