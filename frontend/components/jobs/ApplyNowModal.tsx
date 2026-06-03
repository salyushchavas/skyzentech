'use client';

import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import FileUpload from '@/components/FileUpload';
import type { JobPostingResponse, ResumeResponse } from '@/types';

interface Props {
  posting: JobPostingResponse;
  defaultName?: string;
  defaultEmail?: string;
  onClose: () => void;
  onApplied: (applicationId: string) => void;
}

const REASON_MAX = 500;

export default function ApplyNowModal({
  posting,
  defaultName,
  defaultEmail,
  onClose,
  onApplied,
}: Props) {
  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [showUploader, setShowUploader] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ResumeResponse[]>('/api/v1/resumes/me');
        if (cancelled) return;
        const list = res.data ?? [];
        setResumes(list);
        const def = list.find((r) => r.isDefault) ?? list[0];
        setSelectedResumeId(def?.id ?? '');
        if (list.length === 0) setShowUploader(true);
      } catch {
        if (!cancelled) setError("Couldn't load your resumes. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleResumeUpload(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post<ResumeResponse>('/api/v1/resumes', form);
    const created = res.data;
    setResumes((prev) => [...prev, created]);
    setSelectedResumeId(created.id);
    setShowUploader(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedResumeId) {
      setError('Please upload or select a resume before submitting.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id: string }>('/api/v1/applications', {
        jobPostingId: posting.id,
        resumeId: selectedResumeId,
      });
      onApplied(res.data?.id ?? '');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        setError("You've already applied to this position.");
      } else {
        setError(err?.response?.data?.error ?? 'Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-now-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">Apply for</p>
            <h2 id="apply-now-title" className="truncate text-lg font-semibold text-slate-900">
              {posting.title}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {posting.entityName ? `${posting.entityName} · ` : ''}
              {posting.location}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name" value={defaultName ?? '—'} />
              <Field label="Email" value={defaultEmail ?? '—'} />
            </div>

            <section>
              <h3 className="mb-2 text-sm font-medium text-slate-700">Resume</h3>
              {loading ? (
                <div className="h-10 w-full animate-pulse rounded bg-slate-100" />
              ) : resumes.length > 0 && !showUploader ? (
                <>
                  <select
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fileName}
                        {r.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowUploader(true)}
                    className="mt-2 text-xs font-medium text-primary-700 hover:underline"
                  >
                    Upload a different resume
                  </button>
                </>
              ) : (
                <>
                  <FileUpload onFileSelected={handleResumeUpload} label="Upload your resume" />
                  {resumes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowUploader(false)}
                      className="mt-2 text-xs font-medium text-primary-700 hover:underline"
                    >
                      Cancel and pick existing
                    </button>
                  )}
                </>
              )}
            </section>

            <section>
              <label htmlFor="apply-reason" className="mb-2 block text-sm font-medium text-slate-700">
                Why are you interested? <span className="text-xs font-normal text-slate-500">(optional)</span>
              </label>
              <textarea
                id="apply-reason"
                rows={4}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Share what draws you to this role…"
              />
              <p className="mt-1 text-right text-[11px] text-slate-500">
                {reason.length}/{REASON_MAX}
              </p>
            </section>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedResumeId}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-accent to-accent-dark px-5 py-2 text-sm font-semibold text-white shadow-glow-accent hover:shadow-glow-accent-lg disabled:opacity-50 disabled:shadow-none"
              >
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm text-slate-900">{value}</p>
    </div>
  );
}
