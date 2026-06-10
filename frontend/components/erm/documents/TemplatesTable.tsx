'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreVertical, Upload, EyeOff, Eye } from 'lucide-react';
import api from '@/lib/api';
import {
  CATEGORY_BADGE,
  SENSITIVITY_BADGE,
  SENSITIVITY_LABEL,
  relativeDate,
} from './badges';
import type { DocumentTemplateDto } from './types';

type Props = {
  items: DocumentTemplateDto[];
  loading: boolean;
  onChanged: () => void;
};

export default function TemplatesTable({ items, loading, onChanged }: Props) {
  if (loading && items.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse border-b border-slate-100" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Version</th>
            <th className="px-3 py-2">File</th>
            <th className="px-3 py-2">Sensitivity</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2 w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((t) => <Row key={t.id} t={t} onChanged={onChanged} />)}
        </tbody>
      </table>
    </div>
  );
}

function Row({ t, onChanged }: { t: DocumentTemplateDto; onChanged: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  async function toggleActive() {
    setMenuOpen(false);
    try {
      await api.post(
        `/api/v1/erm/document-templates/${t.id}/${t.isActive ? 'deactivate' : 'reactivate'}`,
      );
      onChanged();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      alert(ax.response?.data?.error ?? ax.message ?? 'Failed');
    }
  }

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
          <p className="text-[11px] text-slate-500 line-clamp-1">{t.description}</p>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_BADGE[t.category ?? 'OTHER'] ?? CATEGORY_BADGE.OTHER}`}>
          {t.category ?? '—'}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
          v{t.version}
        </span>
      </td>
      <td className="px-3 py-2">
        {t.templateFileId ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            Uploaded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            Pending upload
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SENSITIVITY_BADGE[t.sensitivity ?? 'NORMAL'] ?? SENSITIVITY_BADGE.NORMAL}`}>
          {SENSITIVITY_LABEL[t.sensitivity ?? 'NORMAL'] ?? t.sensitivity}
        </span>
      </td>
      <td className="px-3 py-2">
        {t.isActive ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Active
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            Inactive
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-[11px] text-slate-500">
        <span className="block text-slate-700">{t.createdByName ?? '—'}</span>
        <span>{relativeDate(t.createdAt)}</span>
      </td>
      <td className="px-3 py-2 relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Open actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-2 top-9 z-20 w-48 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
              <Link
                href={`/careers/erm/document-templates/${t.id}`}
                className="block px-3 py-1.5 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                View / edit
              </Link>
              <Link
                href={`/careers/erm/document-templates/${t.id}#upload`}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                <Upload className="h-3.5 w-3.5" /> Upload new version
              </Link>
              <button
                type="button"
                onClick={toggleActive}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
              >
                {t.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {t.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </>
        )}
      </td>
    </tr>
  );
}
