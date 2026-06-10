'use client';

import { History } from 'lucide-react';
import type { DocumentTemplateDto } from './types';

type Props = {
  template: DocumentTemplateDto;
};

/**
 * The backend currently retains only `previousVersionFileId` (the immediate
 * predecessor) — not a full version chain. We surface that single prior
 * version here; deeper history will land alongside an audit-log query later.
 */
export default function TemplateVersionHistoryCard({ template }: Props) {
  const hasPrevious = !!template.previousVersionFileId;
  const currentVersion = template.version ?? 1;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Version history</h3>
      </div>

      <ul className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
        <li className="flex items-center justify-between px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-900">
              v{currentVersion} (current)
            </p>
            <p className="text-[11px] text-slate-500">
              {template.templateFileName ?? 'no file'}
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            Active
          </span>
        </li>
        {hasPrevious && currentVersion > 1 && (
          <li className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">
                v{currentVersion - 1}
              </p>
              <p className="text-[11px] text-slate-500">Previous file retained for audit.</p>
            </div>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              Superseded
            </span>
          </li>
        )}
      </ul>

      {!hasPrevious && currentVersion === 1 && (
        <p className="mt-2 text-[11px] text-slate-500">
          No previous versions yet. Re-uploading the file will bump the version and preserve the current one for audit.
        </p>
      )}
    </section>
  );
}
