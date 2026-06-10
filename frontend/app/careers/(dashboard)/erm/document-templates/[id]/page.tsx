'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import TemplateMetadataForm from '@/components/erm/documents/TemplateMetadataForm';
import TemplateFileUploadCard from '@/components/erm/documents/TemplateFileUploadCard';
import TemplateVersionHistoryCard from '@/components/erm/documents/TemplateVersionHistoryCard';
import TemplateUsageStatsCard from '@/components/erm/documents/TemplateUsageStatsCard';
import {
  CATEGORY_BADGE,
  SENSITIVITY_BADGE,
  SENSITIVITY_LABEL,
  relativeDate,
} from '@/components/erm/documents/badges';
import type { DocumentTemplateDto } from '@/components/erm/documents/types';

export default function DocumentTemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [t, setT] = useState<DocumentTemplateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<DocumentTemplateDto>(
        `/api/v1/erm/document-templates/${id}`,
      );
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

  async function toggleActive() {
    if (!id || !t) return;
    setToggling(true);
    try {
      const res = await api.post<DocumentTemplateDto>(
        `/api/v1/erm/document-templates/${id}/${t.isActive ? 'deactivate' : 'reactivate'}`,
      );
      setT(res.data);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      alert(ax.response?.data?.error ?? ax.message ?? 'Failed');
    } finally {
      setToggling(false);
    }
  }

  if (loading && !t) {
    return (
      <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
        <DashboardLayout>
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

        <div className="mb-4">
          <h1 className="text-xl font-semibold text-slate-900">{t.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              v{t.version}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_BADGE[t.category ?? 'OTHER'] ?? CATEGORY_BADGE.OTHER}`}>
              {t.category ?? '—'}
            </span>
            {t.templateFileId ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                File uploaded
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                File pending
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SENSITIVITY_BADGE[t.sensitivity ?? 'NORMAL'] ?? SENSITIVITY_BADGE.NORMAL}`}>
              {SENSITIVITY_LABEL[t.sensitivity ?? 'NORMAL'] ?? t.sensitivity}
            </span>
            {!t.isActive && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                Inactive
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <main className="space-y-4 lg:col-span-2">
            <TemplateMetadataForm template={t} onSaved={(next) => setT(next)} />
            <TemplateFileUploadCard template={t} onUploaded={(next) => setT(next)} />
            <TemplateVersionHistoryCard template={t} />
          </main>

          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Status</h3>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <p>
                  {t.isActive ? (
                    <>Active since{' '}
                      <span className="font-semibold text-slate-800">
                        {new Date(t.updatedAt).toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <>Inactive since{' '}
                      <span className="font-semibold text-slate-800">
                        {new Date(t.updatedAt).toLocaleString()}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleActive}
                disabled={toggling}
                className={
                  'mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold ' +
                  (t.isActive
                    ? 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50'
                    : 'bg-emerald-700 text-white hover:bg-emerald-800')
                }
              >
                {t.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {toggling ? 'Updating…' : t.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </section>

            <TemplateUsageStatsCard template={t} />

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Audit</h3>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="text-slate-500">Created by</dt>
                  <dd className="text-slate-800">{t.createdByName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd className="text-slate-800">
                    {new Date(t.createdAt).toLocaleString()}
                    <span className="ml-1 text-slate-500">({relativeDate(t.createdAt)})</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last updated</dt>
                  <dd className="text-slate-800">
                    {new Date(t.updatedAt).toLocaleString()}
                    <span className="ml-1 text-slate-500">({relativeDate(t.updatedAt)})</span>
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
