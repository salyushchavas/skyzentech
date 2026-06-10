'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Download, Upload } from 'lucide-react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import type { DocumentTemplateDto } from '@/components/erm/documents/types';

export default function DocumentTemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [t, setT] = useState<DocumentTemplateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<DocumentTemplateDto>(`/api/v1/erm/document-templates/${id}`);
      setT(res.data);
      setErr(null);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function uploadFile(file: File) {
    if (!id) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/api/v1/erm/document-templates/${id}/file`, fd);
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      alert(ax.response?.data?.error ?? ax.message ?? 'Upload failed');
    }
  }

  async function downloadFile() {
    if (!id || !t?.templateFileId) return;
    try {
      const res = await api.get<Blob>(`/api/v1/erm/document-templates/${id}/file`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = t.templateFileName ?? 'template';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      alert(ax.response?.data?.error ?? ax.message ?? 'Download failed');
    }
  }

  async function toggleActive() {
    if (!id || !t) return;
    try {
      await api.post(
        `/api/v1/erm/document-templates/${id}/${t.isActive ? 'deactivate' : 'reactivate'}`,
      );
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      alert(ax.response?.data?.error ?? ax.message ?? 'Failed');
    }
  }

  if (loading && !t) {
    return (
      <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
        <DashboardLayout>
          <PageHeader title="Template" />
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        </DashboardLayout>
      </ProtectedRoute>
    );
  }
  if (err || !t) {
    return (
      <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
        <DashboardLayout>
          <PageHeader title="Template" />
          <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {err ?? 'Template not found'}
          </p>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <Link
          href="/careers/erm/document-templates"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" /> Back to templates
        </Link>
        <PageHeader
          title={t.title}
          subtitle={t.description ?? undefined}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <main className="lg:col-span-2 space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Template file</h3>
                <span className="text-xs text-slate-500">v{t.version}</span>
              </div>
              <div className="mt-3">
                {t.templateFileName ? (
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-700">{t.templateFileName}</span>
                    <button
                      type="button"
                      onClick={downloadFile}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  </div>
                ) : (
                  <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    No file uploaded yet — interns cannot be assigned this template until a file is in place.
                  </p>
                )}
                <div className="mt-3">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t.templateFileName ? 'Replace file (bumps version)' : 'Upload file'}
                  </button>
                </div>
              </div>
            </section>

            {t.instructions && (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Instructions to intern</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{t.instructions}</p>
              </section>
            )}
          </main>

          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metadata</h3>
              <Row label="Category" value={t.category ?? '—'} />
              <Row label="Sensitivity" value={t.sensitivity ?? 'GENERAL'} />
              <Row label="Used by" value={String(t.usageCount)} />
              <Row label="Created"
                value={new Date(t.createdAt).toLocaleString()} />
              <Row label="Updated"
                value={new Date(t.updatedAt).toLocaleString()} />
            </section>
            <button
              type="button"
              onClick={toggleActive}
              className={
                'w-full rounded-md px-3 py-2 text-sm font-semibold ' +
                (t.isActive
                  ? 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50'
                  : 'bg-emerald-700 text-white hover:bg-emerald-800')
              }
            >
              {t.isActive ? 'Deactivate template' : 'Reactivate template'}
            </button>
          </aside>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mb-2 text-sm">
      <p className="text-[11px] uppercase text-slate-500">{label}</p>
      <p className="text-slate-800">{value ?? '—'}</p>
    </div>
  );
}
