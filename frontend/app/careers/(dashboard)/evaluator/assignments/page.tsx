'use client';

import { Plus } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';

type AssignmentStatus = 'Assigned' | 'In Progress' | 'Submitted' | 'Reviewed';

interface Assignment {
  intern: string;
  week: string;
  title: string;
  status: AssignmentStatus;
  due: string;
  submitted: string;
  rating: string;
  primaryAction: string;
}

const ASSIGNMENTS: Assignment[] = [
  { intern: 'Lin Zhou', week: 'W5', title: 'Implement search filters on /careers/openings', status: 'In Progress', due: 'Fri May 23', submitted: '—', rating: '—', primaryAction: 'View' },
  { intern: 'Aisha Patel', week: 'W3', title: 'Deploy auth service to staging', status: 'Submitted', due: 'May 17', submitted: 'May 19', rating: '—', primaryAction: 'Review' },
  { intern: 'Marcus Chen', week: 'W4', title: 'Refactor toast notification system', status: 'Reviewed', due: 'May 17', submitted: 'May 18', rating: '⭐ 4.8', primaryAction: 'View Feedback' },
  { intern: 'Devon King', week: 'W8', title: 'Build candidate matching algorithm', status: 'Submitted', due: 'May 17', submitted: 'May 17', rating: '—', primaryAction: 'Review' },
  { intern: 'Priya Sharma', week: 'W2', title: 'Write E2E tests for application flow', status: 'Assigned', due: 'May 24', submitted: '—', rating: '—', primaryAction: 'Edit' },
  { intern: 'Jamal Williams', week: 'W6', title: 'API rate limiting implementation', status: 'Reviewed', due: 'May 13', submitted: 'May 14', rating: '⭐ 4.2', primaryAction: 'View Feedback' },
];

const STATUS_CLASS: Record<AssignmentStatus, string> = {
  Assigned: 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-purple-100 text-purple-800',
  Submitted: 'bg-amber-100 text-amber-800',
  Reviewed: 'bg-green-100 text-green-800',
};

export default function EvaluatorAssignmentsPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_EVALUATOR', 'ADMIN']}>
      <DashboardLayout title="Weekly Assignments">
        <PreviewShell>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <select className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
              <option>All Interns</option>
              <option>Lin Zhou</option>
              <option>Aisha Patel</option>
              <option>Marcus Chen</option>
              <option>Devon King</option>
              <option>Priya Sharma</option>
              <option>Jamal Williams</option>
            </select>
            <MockButton icon={<Plus className="h-4 w-4" />}>Create Assignment</MockButton>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Intern</th>
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ASSIGNMENTS.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.intern}</td>
                    <td className="px-4 py-3 text-gray-700">{a.week}</td>
                    <td className="px-4 py-3 text-gray-700">{a.title}</td>
                    <td className="px-4 py-3">
                      <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ' + STATUS_CLASS[a.status]}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{a.due}</td>
                    <td className="px-4 py-3 text-gray-700">{a.submitted}</td>
                    <td className="px-4 py-3 text-gray-700">{a.rating}</td>
                    <td className="px-4 py-3 text-right">
                      <MockButton variant="secondary">{a.primaryAction}</MockButton>
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
