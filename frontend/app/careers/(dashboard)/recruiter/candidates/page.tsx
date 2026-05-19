'use client';

import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';

interface Candidate {
  name: string;
  email: string;
  positions: string;
  status: { label: string; tone: 'blue' | 'amber' | 'purple' | 'green' | 'red' };
  applied: string;
  resume: string;
}

const CANDIDATES: Candidate[] = [
  { name: 'Priya Sharma', email: 'priya.sharma@example.com', positions: 'Backend Dev Intern', status: { label: 'Interview Scheduled', tone: 'purple' }, applied: 'May 10', resume: 'priya_resume.pdf' },
  { name: 'Marcus Chen', email: 'marcus.chen@example.com', positions: 'Frontend Dev Intern', status: { label: 'Offer Extended', tone: 'amber' }, applied: 'May 8', resume: 'marcus_chen.pdf' },
  { name: 'Aisha Patel', email: 'aisha.patel@example.com', positions: 'Cloud Eng Intern, Backend Dev Intern', status: { label: 'Hired', tone: 'green' }, applied: 'Apr 30', resume: 'aisha_patel_v2.pdf' },
  { name: 'Jamal Williams', email: 'jamal.w@example.com', positions: 'Backend Dev Intern', status: { label: 'Shortlisted', tone: 'blue' }, applied: 'May 4', resume: 'jamal_williams.pdf' },
  { name: 'Lin Zhou', email: 'lin.zhou@example.com', positions: 'Frontend Dev Intern', status: { label: 'Hired', tone: 'green' }, applied: 'Apr 12', resume: 'lin_zhou_resume.pdf' },
  { name: 'Devon King', email: 'devon.king@example.com', positions: 'Backend Dev Intern', status: { label: 'Rejected', tone: 'red' }, applied: 'May 1', resume: 'devon_king.pdf' },
  { name: 'Maya Patel', email: 'maya.patel@example.com', positions: 'Cloud Eng Intern', status: { label: 'Applied', tone: 'blue' }, applied: 'May 18', resume: 'maya_patel_v1.pdf' },
];

const TONE_CLASS = {
  blue: 'bg-blue-100 text-blue-800',
  amber: 'bg-amber-100 text-amber-800',
  purple: 'bg-purple-100 text-purple-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-700',
} as const;

export default function RecruiterCandidatesPage() {
  return (
    <ProtectedRoute requiredRoles={['RECRUITER', 'ERM', 'ADMIN']}>
      <DashboardLayout title="Candidates">
        <PreviewShell>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search by name or email..."
              className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <select className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
              <option>All positions</option>
              <option>Backend Dev Intern</option>
              <option>Frontend Dev Intern</option>
              <option>Cloud Eng Intern</option>
            </select>
            <select className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
              <option>All statuses</option>
              <option>Applied</option>
              <option>Shortlisted</option>
              <option>Interview Scheduled</option>
              <option>Hired</option>
              <option>Rejected</option>
            </select>
            <select className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
              <option>All dates</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Position(s) Applied</th>
                  <th className="px-4 py-3">Latest Status</th>
                  <th className="px-4 py-3">Applied</th>
                  <th className="px-4 py-3">Resume</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {CANDIDATES.map((c) => (
                  <tr
                    key={c.email}
                    onClick={() => toast('Candidate profile coming soon', { icon: '✨' })}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.positions}</td>
                    <td className="px-4 py-3">
                      <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ' + TONE_CLASS[c.status.tone]}>
                        {c.status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.applied}</td>
                    <td className="px-4 py-3 text-gray-700">{c.resume}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <MockButton variant="ghost">View profile</MockButton>
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
