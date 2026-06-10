'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus } from 'lucide-react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_SENSITIVITIES,
  FILE_KINDS,
  SENSITIVITY_LABEL,
} from '@/components/erm/documents/badges';
import type { DocumentTemplateDto } from '@/components/erm/documents/types';

export default function NewDocumentTemplatePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [fileKind, setFileKind] = useState('PDF');
  const [sensitivity, setSensitivity] = useState('NORMAL');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!title.trim()) { setErr('Title is required'); return; }
    if (title.length > 200) { setErr('Title must be 200 chars or fewer'); return; }
    if (description.length > 2000) { setErr('Description max 2000 chars'); return; }
    if (instructions.length > 5000) { setErr('Instructions max 5000 chars'); return; }
    setSubmitting(true);
    try {
      const res = await api.post<DocumentTemplateDto>(
        '/api/v1/erm/document-templates',
        {
          title: title.trim(),
          description: description.trim() || null,
          category,
          fileKind,
          sensitivity,
          instructions: instructions.trim() || null,
        },
      );
      router.push(`/careers/erm/document-templates/${res.data.id}#upload`);
    } catch (e) {
      const ax = e as { response?: { status?: number; data?: { error?: string } }; message?: string };
      if (ax.response?.status === 409) {
        setErr('A template with this title already exists. Pick a different title.');
      } else {
        setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to create');
      }
    } finally {
      setSubmitting(false);
    }
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
          title="Add new document template"
          subtitle="Create the metadata first — you'll upload the actual file on the next step."
        />

        <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <Field label={`Title* (${title.length}/200)`}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. W-4 2027"
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              />
            </Field>

            <Field label={`Description (${description.length}/2000)`}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="What this template is for. Shown to ERM agents in the library."
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Category*">
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
              <Field label="File kind*">
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
              <Field label="Sensitivity*">
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
                placeholder="Optional. How the intern should complete this form, what to attach, etc."
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              />
            </Field>

            {err && (
              <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                {err}
              </p>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Link
              href="/careers/erm/document-templates"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !title.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
            >
              <Plus className="h-4 w-4" /> {submitting ? 'Creating…' : 'Create template'}
            </button>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
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
