'use client';

import Link from 'next/link';
import { BarChart3, ArrowUpRight } from 'lucide-react';
import type { DocumentTemplateDto } from './types';

export default function TemplateUsageStatsCard({
  template,
}: { template: DocumentTemplateDto }) {
  const usage = template.usageCount ?? 0;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Usage</h3>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900">{usage}</p>
      <p className="text-xs text-slate-500">
        {usage === 1 ? 'document packet using this template' : 'document packets using this template'}
      </p>
      {usage > 0 && (
        <Link
          href={`/careers/erm/document-packets?templateId=${template.id}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
        >
          View packets <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </section>
  );
}
