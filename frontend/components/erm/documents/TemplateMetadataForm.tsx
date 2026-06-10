'use client';

import { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_SENSITIVITIES,
  FILE_KINDS,
  SENSITIVITY_LABEL,
} from './badges';
import type { DocumentTemplateDto } from './types';

type Props = {
  template: DocumentTemplateDto;
  onSaved: (next: DocumentTemplateDto) => void;
};

export default function TemplateMetadataForm({ template, onSaved }: Props) {
  const [description, setDescription] = useState(template.description ?? '');
  const [category, setCategory] = useState(template.category ?? 'OTHER');
  const [fileKind, setFileKind] = useState(template.fileKind ?? 'PDF');
  const [sensitivity, setSensitivity] = useState(template.sensitivity ?? 'NORMAL');
  const [instructions, setInstructions] = useState(template.instructions ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDescription(template.description ?? '');
    setCategory(template.category ?? 'OTHER');
    setFileKind(template.fileKind ?? 'PDF');
    setSensitivity(template.sensitivity ?? 'NORMAL');
    setInstructions(template.instructions ?? '');
  }, [template]);

  const dirty =
    description !== (template.description ?? '')
    || category !== (template.category ?? 'OTHER')
    || fileKind !== (template.fileKind ?? 'PDF')
    || sensitivity !== (template.sensitivity ?? 'NORMAL')
    || instructions !== (template.instructions ?? '');

  function discard() {
    setDescription(template.description ?? '');
    setCategory(template.category ?? 'OTHER');
    setFileKind(template.fileKind ?? 'PDF');
    setSensitivity(template.sensitivity ?? 'NORMAL');
    setInstructions(template.instructions ?? '');
    setErr(null);
  }

  async function save() {
    if (description.length > 2000) { setErr('Description max 2000 chars'); return; }
    if (instructions.length > 5000) { setErr('Instructions max 5000 chars'); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await api.put<DocumentTemplateDto>(
        `/api/v1/erm/document-templates/${template.id}`,
        {
          description: description.trim() || null,
          category,
          fileKind,
          sensitivity,
          instructions: instructions.trim() || null,
        },
      );
      onSaved(res.data);
      setSavedAt(Date.now());
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Template metadata</h3>
        {savedAt && !dirty && (
          <span className="text-[11px] text-emerald-700">
            Saved {Math.max(1, Math.round((Date.now() - savedAt) / 1000))}s ago
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Title (immutable)">
          <input
            value={template.title}
            disabled
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-500"
          />
        </Field>

        <Field label={`Description (${description.length}/2000)`}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            >
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="File kind">
            <select
              value={fileKind}
              onChange={(e) => setFileKind(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            >
              {FILE_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label="Sensitivity">
            <select
              value={sensitivity}
              onChange={(e) => setSensitivity(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            >
              {TEMPLATE_SENSITIVITIES.map((s) => (
                <option key={s} value={s}>{SENSITIVITY_LABEL[s]}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={`Instructions to intern (${instructions.length}/5000)`}>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="Shown to the intern alongside the download link. Explain how to complete this form, what to attach, etc."
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </Field>

        {err && (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
            {err}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={discard}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
