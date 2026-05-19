'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import FileUpload from '@/components/FileUpload';
import type { ResumeResponse } from '@/types';

export default function ResumesPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="My Resumes">
        <ResumeManager />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function ResumeManager() {
  const [resumes, setResumes] = useState<ResumeResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ResumeResponse[]>('/api/v1/resumes/me');
      setResumes(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load your resumes.");
      setResumes(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function showToast(kind: 'success' | 'error', message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleUpload(file: File) {
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post('/api/v1/resumes', form);
      showToast('success', 'Resume uploaded.');
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Upload failed.';
      showToast('error', msg);
      throw err; // surface error inside FileUpload too
    }
  }

  async function setDefault(id: string) {
    setPendingId(id);
    try {
      await api.patch(`/api/v1/resumes/${id}/default`);
      showToast('success', 'Default resume updated.');
      await load();
    } catch (err: any) {
      showToast('error', err?.response?.data?.error ?? "Couldn't set default.");
    } finally {
      setPendingId(null);
    }
  }

  async function deleteResume(id: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    setPendingId(id);
    try {
      await api.delete(`/api/v1/resumes/${id}`);
      showToast('success', 'Resume deleted.');
      await load();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        showToast('error', "Can't delete — used in an active application.");
      } else {
        showToast('error', err?.response?.data?.error ?? 'Delete failed.');
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">My Resumes</h1>
      <p className="mb-6 text-sm text-slate-600">
        Upload PDF or Word resumes. Set one as default to pre-select it when applying.
      </p>

      {toast && (
        <div
          className={
            'mb-6 rounded border p-3 text-sm ' +
            (toast.kind === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700')
          }
        >
          {toast.message}
        </div>
      )}

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Upload a new resume</h2>
        <FileUpload onFileSelected={handleUpload} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Your resumes</h2>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="mb-2">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {!resumes && !error && (
          <div className="flex items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          </div>
        )}

        {resumes && resumes.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No resumes uploaded yet.
          </div>
        )}

        {resumes && resumes.length > 0 && (
          <div className="space-y-3">
            {resumes.map((r) => (
              <div
                key={r.id}
                className="flex flex-col items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{r.fileName}</span>
                    {r.isDefault && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatBytes(r.fileSize)} · uploaded {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  {!r.isDefault && (
                    <button
                      type="button"
                      onClick={() => void setDefault(r.id)}
                      disabled={pendingId === r.id}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteResume(r.id, r.fileName)}
                    disabled={pendingId === r.id}
                    className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function formatBytes(n?: number): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

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
