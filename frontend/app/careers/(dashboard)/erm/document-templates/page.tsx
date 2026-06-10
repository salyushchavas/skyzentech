'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import TemplatesTable from '@/components/erm/documents/TemplatesTable';
import { TEMPLATE_CATEGORIES, type TemplateCategory } from '@/components/erm/documents/badges';
import type { DocumentTemplatePage } from '@/components/erm/documents/types';

export default function DocumentTemplatesPage() {
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<DocumentTemplatePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      // Backend list takes one category at a time; if the user selects
      // multiple chips we fetch unfiltered and narrow client-side. With
      // 13 seeded templates + a 100-row page cap this is fine.
      if (categories.length === 1) params.set('category', categories[0]);
      if (activeOnly) params.set('activeOnly', 'true');
      params.set('page', String(page));
      params.set('pageSize', '100');
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
  }, [search, categories, activeOnly, page]);

  useEffect(() => { void load(); }, [load]);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (categories.length <= 1) return data.items;
    const set = new Set<string>(categories);
    return data.items.filter((t) => t.category && set.has(t.category));
  }, [data, categories]);

  const anyFilter = search.trim().length > 0 || categories.length > 0 || !activeOnly;

  function toggleCategory(c: TemplateCategory) {
    setCategories((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
    setPage(0);
  }

  function clearFilters() {
    setSearch('');
    setCategories([]);
    setActiveOnly(true);
    setPage(0);
  }

  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            title="Document Templates Library"
            subtitle="Manage the document templates ERM assigns to interns during onboarding."
          />
          <Link
            href="/careers/erm/document-templates/new"
            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" /> Add template
          </Link>
        </div>

        <div className="sticky top-0 z-10 -mx-1 mb-4 mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search title or description"
              className="min-w-[220px] flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => { setActiveOnly(e.target.checked); setPage(0); }}
              />
              Active only
            </label>
            {anyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase text-slate-500">
              Category
            </span>
            {TEMPLATE_CATEGORIES.map((c) => {
              const on = categories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={
                    'rounded-full border px-2.5 py-0.5 text-[11px] font-medium ' +
                    (on
                      ? 'border-teal-700 bg-teal-700 text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50')
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {err && (
          <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {err}
          </p>
        )}

        {!loading && filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm text-slate-600">No templates match your filters.</p>
            {anyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <TemplatesTable items={filteredItems} loading={loading} onChanged={load} />
        )}

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
      </DashboardLayout>
    </ProtectedRoute>
  );
}
