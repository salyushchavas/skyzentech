'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';

interface I9Row {
  candidate: string;
  position: string;
  firstDay: string;
  deadline: string;
  section1: 'complete' | 'pending' | 'na';
  section2: 'complete' | 'pending' | 'na';
  status: { label: string; tone: 'red' | 'amber' | 'green' | 'gray' };
  showOverdueIcon?: boolean;
}

const I9_ROWS: I9Row[] = [
  { candidate: 'Priya Sharma', position: 'Backend Dev Intern', firstDay: 'May 14, 2026', deadline: 'May 17, 2026 (OVERDUE)', section1: 'complete', section2: 'pending', status: { label: 'OVERDUE', tone: 'red' }, showOverdueIcon: true },
  { candidate: 'Marcus Chen', position: 'Frontend Dev Intern', firstDay: 'May 19, 2026', deadline: 'May 22, 2026', section1: 'complete', section2: 'pending', status: { label: 'Due in 3 days', tone: 'amber' } },
  { candidate: 'Aisha Patel', position: 'Cloud Eng Intern', firstDay: 'May 26, 2026', deadline: 'May 29, 2026', section1: 'pending', section2: 'na', status: { label: 'Awaiting Section 1', tone: 'gray' } },
  { candidate: 'Lin Zhou', position: 'Frontend Dev Intern', firstDay: 'May 1, 2026', deadline: 'May 4, 2026', section1: 'complete', section2: 'complete', status: { label: 'Verified', tone: 'green' } },
  { candidate: 'Jamal Williams', position: 'Backend Dev Intern', firstDay: 'Not yet started', deadline: 'TBD', section1: 'na', section2: 'na', status: { label: 'Pre-employment', tone: 'gray' } },
];

const TONE_CLASS = {
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-green-100 text-green-800',
  gray: 'bg-gray-200 text-gray-700',
} as const;

interface EverifyCase {
  candidate: string;
  status: string;
  tone: 'green' | 'amber' | 'gray';
  opened: string;
}

const EVERIFY_CASES: EverifyCase[] = [
  { candidate: 'Marcus Chen', status: 'Employment Authorized', tone: 'green', opened: 'May 19, 2026' },
  { candidate: 'Aisha Patel', status: 'Tentative Nonconfirmation', tone: 'amber', opened: 'May 18, 2026' },
  { candidate: 'Lin Zhou', status: 'Case Closed', tone: 'gray', opened: 'May 1, 2026' },
];

type Tab = 'i9' | 'everify' | 'history';

export default function HrI9EverifyPage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="I-9 & E-Verify">
        <PreviewShell>
          <Body />
        </PreviewShell>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [tab, setTab] = useState<Tab>('i9');

  return (
    <>
      <div className="mb-6 inline-flex rounded-md border border-gray-300 bg-white p-0.5">
        {(
          [
            { key: 'i9', label: 'I-9 Forms' },
            { key: 'everify', label: 'E-Verify Cases' },
            { key: 'history', label: 'History' },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'rounded px-3 py-1.5 text-xs font-medium transition-colors ' +
              (tab === t.key
                ? 'bg-accent text-white'
                : 'text-gray-600 hover:bg-gray-100')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'i9' && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">First Day</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Section 1</th>
                <th className="px-4 py-3">Section 2</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {I9_ROWS.map((r) => (
                <tr key={r.candidate} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.candidate}</td>
                  <td className="px-4 py-3 text-gray-700">{r.position}</td>
                  <td className="px-4 py-3 text-gray-700">{r.firstDay}</td>
                  <td className="px-4 py-3 text-gray-700">{r.deadline}</td>
                  <td className="px-4 py-3">{sectionPill(r.section1)}</td>
                  <td className="px-4 py-3">{sectionPill(r.section2)}</td>
                  <td className="px-4 py-3">
                    <span className={'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ' + TONE_CLASS[r.status.tone]}>
                      {r.showOverdueIcon && <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />}
                      {r.status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MockButton>Open Form</MockButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'everify' && (
        <div className="space-y-3">
          {EVERIFY_CASES.map((c) => (
            <div
              key={c.candidate}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div>
                <div className="font-medium text-gray-900">{c.candidate}</div>
                <div className="text-xs text-gray-500">Opened {c.opened}</div>
              </div>
              <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + TONE_CLASS[c.tone]}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
          Audit log of all I-9 and E-Verify events will appear here.
        </div>
      )}
    </>
  );
}

function sectionPill(s: 'complete' | 'pending' | 'na') {
  if (s === 'complete') return <span className="text-green-700">✅ Complete</span>;
  if (s === 'pending') return <span className="text-amber-700">⏳ Pending</span>;
  return <span className="text-gray-400">—</span>;
}
