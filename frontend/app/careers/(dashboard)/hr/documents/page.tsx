'use client';

import { useState } from 'react';
import { FileText, Lock } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';
import StatCard from '@/components/preview/StatCard';

type DocType = 'I-9' | 'I-983' | 'Resume' | 'Offer Letter' | 'Audit Report';

interface DocRow {
  filename: string;
  type: DocType;
  candidate: string;
  created: string;
  retention: string;
  version: string;
  actions: string[];
}

const DOCS: DocRow[] = [
  { filename: 'Priya_Sharma_I9.pdf', type: 'I-9', candidate: 'Priya Sharma', created: 'May 14, 2026', retention: 'May 14, 2029', version: 'v2', actions: ['View', 'Download', 'Audit Log'] },
  { filename: 'Marcus_Chen_I983.pdf', type: 'I-983', candidate: 'Marcus Chen', created: 'May 8, 2026', retention: 'May 8, 2029', version: 'v3 (Latest)', actions: ['View', 'History (3)'] },
  { filename: 'Aisha_Patel_Resume.pdf', type: 'Resume', candidate: 'Aisha Patel', created: 'Apr 30, 2026', retention: '—', version: 'v1', actions: ['View', 'Download'] },
  { filename: 'Lin_Zhou_OfferLetter.pdf', type: 'Offer Letter', candidate: 'Lin Zhou', created: 'May 1, 2026', retention: 'Permanent', version: 'Signed', actions: ['View'] },
  { filename: 'Jamal_Williams_I9.pdf', type: 'I-9', candidate: 'Jamal Williams', created: 'May 12, 2026', retention: 'May 12, 2029', version: 'v1', actions: ['View', 'Audit Log'] },
  { filename: 'Quarterly_Audit_2026Q1.pdf', type: 'Audit Report', candidate: '(Internal)', created: 'Apr 1, 2026', retention: 'Permanent', version: 'v1', actions: ['View'] },
];

const FILTERS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'I-9', label: 'I-9' },
  { key: 'I-983', label: 'I-983' },
  { key: 'Offer Letter', label: 'Offer Letters' },
  { key: 'Resume', label: 'Resumes' },
  { key: 'Other', label: 'Other' },
];

const ENCRYPTED_TYPES: ReadonlyArray<DocType> = ['I-9', 'I-983'];

export default function HrDocumentsPage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="Document Vault">
        <PreviewShell>
          <Body />
        </PreviewShell>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all'
    ? DOCS
    : filter === 'Other'
      ? DOCS.filter((d) => d.type === 'Audit Report')
      : DOCS.filter((d) => d.type === filter);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Search documents..."
          className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                'rounded px-3 py-1 text-xs font-medium transition-colors ' +
                (filter === f.key
                  ? 'bg-accent text-white'
                  : 'text-gray-600 hover:bg-gray-100')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Documents" value={247} icon={FileText} />
        <StatCard label="I-9 Records" value={38} />
        <StatCard label="I-983 Records" value={24} />
        <StatCard label="Retention Expiring (30d)" value={6} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Candidate</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Retention Until</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((d) => (
              <tr key={d.filename} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {ENCRYPTED_TYPES.includes(d.type) && (
                      <Lock className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{d.filename}</div>
                      {ENCRYPTED_TYPES.includes(d.type) && (
                        <div className="text-[11px] text-gray-400">🔒 KMS Encrypted</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{d.type}</td>
                <td className="px-4 py-3 text-gray-700">{d.candidate}</td>
                <td className="px-4 py-3 text-gray-700">{d.created}</td>
                <td className="px-4 py-3 text-gray-700">{d.retention}</td>
                <td className="px-4 py-3 text-gray-700">{d.version}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {d.actions.map((a, i) => (
                      <MockButton key={i} variant="ghost">
                        {a}
                      </MockButton>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
