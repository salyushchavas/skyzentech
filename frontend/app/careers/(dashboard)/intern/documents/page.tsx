'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Lock } from 'lucide-react';
import api from '@/lib/api';
import InternPageShell from '@/components/intern/InternPageShell';

interface DocumentMetadata {
  id: string;
  ownerUserId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  sensitivity: 'NORMAL' | 'PII' | 'FINANCIAL' | 'GOVERNMENT_ID' | string;
  encrypted: boolean;
  createdAt: string;
}

const SENSITIVITY_BADGE: Record<string, string> = {
  NORMAL:        'bg-slate-100 text-slate-700',
  PII:           'bg-amber-100 text-amber-800',
  FINANCIAL:     'bg-blue-100 text-blue-800',
  GOVERNMENT_ID: 'bg-rose-100 text-rose-800',
};

const CATEGORY_LABEL: Record<string, string> = {
  W4:                'W-4',
  I9:                'I-9',
  ACH:               'Direct Deposit',
  EMERGENCY_CONTACT: 'Emergency Contact',
  HANDBOOK_ACK:      'Handbook',
  I983:              'I-983',
  EVERIFY:           'E-Verify',
  SIGNED_OFFER:      'Signed Offer',
  RESUME:            'Resume',
  OTHER:             'Other',
};

export default function InternDocumentsPage() {
  const [docs, setDocs] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DocumentMetadata[]>('/api/v1/documents/mine');
      setDocs(res.data ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load your documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function download(id: string) {
    window.open(`/api/v1/documents/${id}/content`, '_blank');
  }

  if (loading) {
    return (
      <InternPageShell title="Documents">
        <div className="h-32 animate-pulse rounded-lg bg-slate-50" aria-hidden />
      </InternPageShell>
    );
  }
  if (err) {
    return (
      <InternPageShell title="Documents">
        <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{err}</p>
      </InternPageShell>
    );
  }

  // Group by category for the listing.
  const grouped = new Map<string, DocumentMetadata[]>();
  docs.forEach((d) => {
    const key = d.category;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  });

  return (
    <InternPageShell title="Documents" subtitle="Signed offer, onboarding forms, and personal records.">
      {docs.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Your document vault is empty for now. Signed forms appear here once you complete onboarding.
        </p>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, rows]) => (
            <section key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {CATEGORY_LABEL[category] ?? category}
              </h2>
              <ul className="space-y-2">
                {rows.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                      <FileText className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-900">{d.fileName}</span>
                        {d.encrypted && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                            <Lock className="h-3 w-3" /> Encrypted
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className={'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ' + (SENSITIVITY_BADGE[d.sensitivity] ?? 'bg-slate-100 text-slate-700')}>
                          {d.sensitivity}
                        </span>
                        <span>{Math.round(d.fileSize / 1024)} KB</span>
                        <span>·</span>
                        <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => download(d.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </InternPageShell>
  );
}
