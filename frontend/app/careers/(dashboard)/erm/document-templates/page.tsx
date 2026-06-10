'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import type {
  DocumentTemplateDto,
  DocumentTemplatePage,
} from '@/components/erm/documents/types';

const CATEGORIES = ['', 'PAYROLL', 'IDENTITY', 'ACKNOWLEDGEMENT', 'AGREEMENT', 'OTHER'];

export default function DocumentTemplatesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<DocumentTemplatePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (category) params.set('category', category);
      if (!includeInactive) params.set('activeOnly', 'true');
      params.set('page', String(page));
      params.set('pageSize', '25');
      const res = await api.get<DocumentTemplatePage>(
        `/api/v1/erm/document-templates?${params.toString()}`,
      );
      setData(res.data);
      setErr(null);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [search, category, includeInactive, page]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="Document Templates"
          subtitle="Library of standard onboarding documents — ERM curates which ones apply per intern."
        />

        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(0); void load(); } }}
              placeholder="Search title / description"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            />
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(0); }}
              className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c || 'All categories'}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => { setIncludeInactive(e.target.checked); setPage(0); }}
              /> include inactive
            </label>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" /> New template
          </button>
        </div>

        {err && (
          <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {err}
          </p>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {loading && !data ? (
            <div className="h-48 animate-pulse" />
          ) : !data || data.items.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">
              No templates match the current filters.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Sensitivity</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Used by</th>
                  <th className="px-3 py-2">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((t) => <Row key={t.id} t={t} />)}
              </tbody>
            </table>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {data.page + 1} of {data.totalPages} ({data.totalElements} total)
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={data.page + 1 >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {creating && (
          <NewTemplateModal
            onClose={() => setCreating(false)}
            onCreated={() => { setCreating(false); void load(); }}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Row({ t }: { t: DocumentTemplateDto }) {
  return (
    <tr>
      <td className="px-3 py-2">
        <Link
          href={`/careers/erm/document-templates/${t.id}`}
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          {t.title}
        </Link>
        {t.description && (
          <p className="text-[11px] text-slate-500">{t.description}</p>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">{t.category ?? '—'}</td>
      <td className="px-3 py-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
          {t.sensitivity ?? 'GENERAL'}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">v{t.version}</td>
      <td className="px-3 py-2 text-xs">
        {t.templateFileName ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
            {t.templateFileName}
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
            No file
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">{t.usageCount}</td>
      <td className="px-3 py-2">
        {t.isActive ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            Active
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            Inactive
          </span>
        )}
      </td>
    </tr>
  );
}

function NewTemplateModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [sensitivity, setSensitivity] = useState('GENERAL');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) { setErr('Title is required'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/v1/erm/document-templates', {
        title: title.trim(),
        description: description.trim() || null,
        category,
        sensitivity,
        instructions: instructions.trim() || null,
      });
      onCreated();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">New document template</h3>
        <p className="mt-1 text-xs text-slate-500">
          Create the metadata now; upload the actual file from the detail page.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Title*</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              >
                {CATEGORIES.filter((c) => c).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Sensitivity</span>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              >
                {['GENERAL', 'PII', 'FINANCIAL', 'GOVERNMENT_ID'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">
              Instructions to intern (optional)
            </span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          {err && (
            <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              {err}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
          >
            <Upload className="h-4 w-4" /> {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
