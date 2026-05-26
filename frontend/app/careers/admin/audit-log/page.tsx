'use client';

import { useCallback, useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import api from '@/lib/api';
import { formatFull } from '@/lib/format-date';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import type { Uuid } from '@/types';

interface AuditLogEntryResponse {
  id: Uuid;
  timestamp: string;
  actorId: Uuid | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: Uuid | null;
  details: string | null;
}

interface PagedAuditLogResponse {
  content: AuditLogEntryResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  return (
    <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'EXECUTIVE']}>
      <DashboardLayout title="Audit Log">
        <AuditLogViewer />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function AuditLogViewer() {
  const [data, setData] = useState<PagedAuditLogResponse | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Filter state (committed). The form state below is what's in the inputs;
  // hitting Apply (or pressing Enter) writes form -> committed.
  const [committed, setCommitted] = useState<{
    actorSearch: string;
    action: string;
    from: string;
    to: string;
  }>({ actorSearch: '', action: '', from: '', to: '' });
  const [form, setForm] = useState(committed);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        size: PAGE_SIZE,
      };
      if (committed.actorSearch.trim()) params.actorSearch = committed.actorSearch.trim();
      if (committed.action) params.action = committed.action;
      if (committed.from) params.from = `${committed.from}T00:00:00Z`;
      if (committed.to) params.to = `${committed.to}T23:59:59Z`;
      const res = await api.get<PagedAuditLogResponse>('/api/v1/admin/audit-log', {
        params,
      });
      setData(
        res.data ?? {
          content: [],
          page,
          size: PAGE_SIZE,
          totalElements: 0,
          totalPages: 0,
        },
      );
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the audit log.");
      setData(null);
    }
  }, [page, committed]);

  const loadActions = useCallback(async () => {
    try {
      const res = await api.get<string[]>('/api/v1/admin/audit-log/actions');
      setActions(res.data ?? []);
    } catch {
      setActions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadActions();
  }, [loadActions]);

  const applyFilters = () => {
    setCommitted(form);
    setPage(0);
  };

  const totalPages = data?.totalPages ?? 0;
  const currentPage = data?.page ?? 0;

  return (
    <section>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative block lg:col-span-2">
          <span className="sr-only">Search actor</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={form.actorSearch}
            onChange={(e) => setForm((f) => ({ ...f, actorSearch: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFilters();
            }}
            placeholder="Search actor (name or email)"
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <select
          value={form.action}
          onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.from}
          onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="From"
        />
        <input
          type="date"
          value={form.to}
          onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="To"
        />
      </div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          Apply filters
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data === null && !error ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
      ) : (data?.content?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <ScrollText className="mx-auto mb-3 h-8 w-8 text-gray-400" strokeWidth={1.5} />
          <p className="text-sm text-gray-600">No audit entries match those filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {(data?.content ?? []).map((row) => (
                <tr key={row.id} className="border-b border-gray-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {formatFull(row.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{row.actorName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.entityType ?? '—'}</td>
                  <td className="max-w-xs px-4 py-3 text-xs text-gray-500">
                    <span className="block truncate" title={row.details ?? ''}>
                      {row.details ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-600">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            ‹ Prev
          </button>
          <span>
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            Next ›
          </button>
        </div>
      )}
    </section>
  );
}
