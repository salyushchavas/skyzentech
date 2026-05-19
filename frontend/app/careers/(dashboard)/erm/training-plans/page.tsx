'use client';

import { AlertCircle, CheckCircle, Clock, FileBadge, Plus } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';
import StatCard from '@/components/preview/StatCard';

type DsoStatus = 'Draft' | 'Submitted to DSO' | 'Approved' | 'Needs Revision';

interface Plan {
  candidate: string;
  position: string;
  created: string;
  status: DsoStatus;
  updated: string;
  actions: { label: string; variant?: 'primary' | 'secondary' | 'ghost' }[];
}

const PLANS: Plan[] = [
  { candidate: 'Priya Sharma', position: 'Backend Developer Intern', created: 'May 10, 2026', status: 'Submitted to DSO', updated: '2 days ago', actions: [{ label: 'View', variant: 'secondary' }, { label: 'Edit', variant: 'ghost' }] },
  { candidate: 'Marcus Chen', position: 'Frontend Developer Intern', created: 'May 8, 2026', status: 'Approved', updated: '5 days ago', actions: [{ label: 'View', variant: 'secondary' }] },
  { candidate: 'Aisha Patel', position: 'Cloud Engineer Intern', created: 'May 5, 2026', status: 'Draft', updated: '1 hour ago', actions: [{ label: 'Continue', variant: 'primary' }, { label: 'Submit', variant: 'secondary' }] },
  { candidate: 'Jamal Williams', position: 'Backend Developer Intern', created: 'May 1, 2026', status: 'Needs Revision', updated: '3 days ago', actions: [{ label: 'Review Comments', variant: 'secondary' }] },
  { candidate: 'Lin Zhou', position: 'Frontend Developer Intern', created: 'Apr 28, 2026', status: 'Approved', updated: '1 week ago', actions: [{ label: 'View', variant: 'secondary' }] },
];

const STATUS_CLASS: Record<DsoStatus, string> = {
  Draft: 'bg-gray-200 text-gray-700',
  'Submitted to DSO': 'bg-blue-100 text-blue-800',
  Approved: 'bg-green-100 text-green-800',
  'Needs Revision': 'bg-red-100 text-red-700',
};

export default function ErmTrainingPlansPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'ADMIN']}>
      <DashboardLayout title="I-983 Training Plans">
        <PreviewShell>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <input
              type="search"
              placeholder="Search by candidate name..."
              className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <MockButton icon={<Plus className="h-4 w-4" />}>New Training Plan</MockButton>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Plans" value={14} icon={FileBadge} />
            <StatCard label="Pending DSO Submission" value={3} icon={Clock} />
            <StatCard label="Approved by DSO" value={9} icon={CheckCircle} trend={{ direction: 'up', value: '+2 this week' }} />
            <StatCard label="Needs Revision" value={2} icon={AlertCircle} />
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">DSO Status</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PLANS.map((p) => (
                  <tr key={p.candidate} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.candidate}</td>
                    <td className="px-4 py-3 text-gray-700">{p.position}</td>
                    <td className="px-4 py-3 text-gray-700">{p.created}</td>
                    <td className="px-4 py-3">
                      <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ' + STATUS_CLASS[p.status]}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.updated}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {p.actions.map((a, i) => (
                          <MockButton key={i} variant={a.variant ?? 'secondary'}>
                            {a.label}
                          </MockButton>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PreviewShell>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
