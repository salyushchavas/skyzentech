'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import type {
  DocumentTemplateDto,
  DocumentTemplatePage,
} from './types';

type Props = {
  open: boolean;
  lifecycleId: string;
  internName: string | null;
  onClose: () => void;
  onAssigned: () => void;
};

export default function AssignPacketModal({
  open, lifecycleId, internName, onClose, onAssigned,
}: Props) {
  const [templates, setTemplates] = useState<DocumentTemplateDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customInstructions, setCustomInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get<DocumentTemplatePage>(
          '/api/v1/erm/document-templates?pageSize=200&activeOnly=true',
        );
        if (cancelled) return;
        const items = res.data.items.filter(
          (t) => t.isActive && t.templateFileId != null,
        );
        setTemplates(items);
        setErr(null);
      } catch (e) {
        const ax = e as { response?: { data?: { error?: string } }; message?: string };
        if (!cancelled) setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to load templates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) { setErr('Pick at least one template'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/v1/erm/document-packets/assign', {
        internLifecycleId: lifecycleId,
        selectedTemplateIds: Array.from(selected),
        customInstructions: customInstructions.trim() || null,
        perTemplateInstructions: null,
      });
      onAssigned();
    } catch (e) {
      const ax = e as {
        response?: { data?: { error?: string; code?: string; missing?: string[] } };
        message?: string;
      };
      if (ax.response?.data?.code === 'REPORTING_STRUCTURE_INCOMPLETE') {
        setErr('Reporting structure incomplete — missing: '
          + (ax.response.data.missing ?? []).join(', '));
      } else {
        setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to assign');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Assign document packet</h3>
            <p className="text-xs text-slate-500">{internName ?? 'Intern'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {err && (
            <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              {err}
            </p>
          )}
          {loading ? (
            <div className="h-32 animate-pulse rounded-md bg-slate-100" />
          ) : templates.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No active templates with uploaded files. Upload a file on a template before assigning.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {templates.map((t) => {
                const on = selected.has(t.id);
                return (
                  <li key={t.id} className="flex items-start gap-3 px-3 py-2">
                    <input
                      id={`tpl-${t.id}`}
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(t.id)}
                      className="mt-1"
                    />
                    <label htmlFor={`tpl-${t.id}`} className="flex-1 cursor-pointer">
                      <p className="text-sm font-medium text-slate-900">{t.title}</p>
                      {t.description && (
                        <p className="text-[11px] text-slate-500">{t.description}</p>
                      )}
                      <p className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5">{t.category ?? 'OTHER'}</span>
                        <span>v{t.version}</span>
                        <span>· {t.sensitivity ?? 'GENERAL'}</span>
                      </p>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-slate-700">
              Custom instructions to intern (optional)
            </span>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Anything extra for this specific intern — e.g. extended deadline, special instructions."
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <span className="text-xs text-slate-500">{selected.size} selected</span>
          <div className="flex gap-2">
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
              disabled={submitting || selected.size === 0}
              className="rounded-md bg-teal-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
            >
              {submitting ? 'Assigning…' : `Assign ${selected.size} document${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
