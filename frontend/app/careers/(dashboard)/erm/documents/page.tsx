'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import StatCard from '@/components/preview/StatCard';
import DocumentStatusBadge from '@/components/documents/DocumentStatusBadge';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  DocumentRecordResponse,
  DocumentType,
  Page,
} from '@/types';

const TYPE_LABEL: Record<DocumentType, string> = {
  I9: 'I-9',
  I983: 'I-983',
  OFFER: 'Offer Letter',
  RESUME: 'Resume',
};

const TYPE_COLOR: Record<DocumentType, string> = {
  I9: 'bg-red-100 text-red-700',
  I983: 'bg-blue-100 text-blue-700',
  OFFER: 'bg-green-100 text-green-700',
  RESUME: 'bg-gray-100 text-gray-700',
};

const PAGE_SIZE = 500; // demo: fetch everything, paginate client-side stats

export default function DocumentVaultPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM']}>
      <DashboardLayout title="Document Vault">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const router = useRouter();
  const [rows, setRows] = useState<DocumentRecordResponse[] | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'ALL'>('ALL');
  const [statusContains, setStatusContains] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Page<DocumentRecordResponse>>(
        '/api/v1/documents',
        { params: { size: PAGE_SIZE } }
      );
      setRows(res.data?.content ?? []);
      setTotalElements(res.data?.totalElements ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load documents.");
      setRows(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (!rows) return { total: 0, i9: 0, i983: 0, offer: 0 };
    let i9 = 0;
    let i983 = 0;
    let offer = 0;
    for (const r of rows) {
      if (r.type === 'I9') i9++;
      else if (r.type === 'I983') i983++;
      else if (r.type === 'OFFER') offer++;
    }
    return { total: rows.length, i9, i983, offer };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    const s = statusContains.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      if (q) {
        const hay =
          (r.title ?? '').toLowerCase() +
          ' ' +
          (r.candidateName ?? '').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (s) {
        const label = (r.statusLabel ?? '').toLowerCase();
        if (!label.includes(s)) return false;
      }
      return true;
    });
  }, [rows, search, typeFilter, statusContains]);

  async function downloadResume(id: string, filename: string) {
    try {
      const res = await api.get(`/api/v1/resumes/${id}/download`, {
        responseType: 'blob',
      });
      const ctRaw = res.headers['content-type'];
      const contentType =
        typeof ctRaw === 'string' ? ctRaw : 'application/octet-stream';
      const blob = new Blob([res.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cdRaw = res.headers['content-disposition'];
      const cd = typeof cdRaw === 'string' ? cdRaw : '';
      const m = cd.match(/filename="?([^";]+)"?/);
      a.download = m?.[1] ?? filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Download failed');
    }
  }

  function handleRowClick(r: DocumentRecordResponse) {
    if (r.type === 'RESUME') {
      toast('Use the Download button to access this resume', { icon: '📄' });
      return;
    }
    if (r.linkUrl) router.push(r.linkUrl);
  }

  return (
    <>
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search by candidate or document title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as DocumentType | 'ALL')}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="ALL">All types</option>
            <option value="I9">I-9</option>
            <option value="I983">I-983</option>
            <option value="OFFER">Offer Letter</option>
            <option value="RESUME">Resume</option>
          </select>
          <input
            type="text"
            placeholder="Status contains…"
            value={statusContains}
            onChange={(e) => setStatusContains(e.target.value)}
            className="w-44 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Documents"
          value={totalElements || stats.total}
          icon={FileText}
        />
        <StatCard label="I-9 Records" value={stats.i9} icon={FileText} />
        <StatCard label="I-983 Records" value={stats.i983} icon={FileText} />
        <StatCard label="Offer Letters" value={stats.offer} icon={FileText} />
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

      {rows === null && !error && <LoadingSkeleton />}

      {rows !== null && filtered.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-base font-medium text-gray-700">
            No documents match these filters
          </p>
          {(typeFilter !== 'ALL' || search || statusContains) && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('ALL');
                setSearch('');
                setStatusContains('');
              }}
              className="mt-3 text-sm font-medium text-accent hover:text-accent-dark"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr
                  key={r.type + '-' + r.id}
                  onClick={() => handleRowClick(r)}
                  className={
                    'hover:bg-gray-50 ' +
                    (r.type === 'RESUME' ? 'cursor-default' : 'cursor-pointer')
                  }
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {r.title}
                    </div>
                    {r.retentionPolicyText && (
                      <div className="mt-0.5 text-xs italic text-gray-500">
                        Retention: {r.retentionPolicyText}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        'inline-block rounded px-2 py-0.5 text-xs font-medium ' +
                        TYPE_COLOR[r.type]
                      }
                    >
                      {TYPE_LABEL[r.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {r.candidateName ?? '—'}
                    </div>
                    {r.candidateEmail && (
                      <div className="text-xs text-gray-500">
                        {r.candidateEmail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.statusLabel && r.statusColor ? (
                      <DocumentStatusBadge
                        statusLabel={r.statusLabel}
                        color={r.statusColor}
                      />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatDateOnly(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatRelative(r.updatedAt)}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.type === 'RESUME' ? (
                      <button
                        type="button"
                        onClick={() =>
                          void downloadResume(r.id, r.title.replace(/^Resume:\s*/, ''))
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="h-3 w-3" strokeWidth={2} />
                        Download
                      </button>
                    ) : r.linkUrl ? (
                      <Link
                        href={r.linkUrl}
                        className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent-dark"
                      >
                        View
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="space-y-1 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0"
          >
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="ml-auto h-7 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
