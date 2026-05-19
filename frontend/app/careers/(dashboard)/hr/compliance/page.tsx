'use client';

import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';
import StatCard from '@/components/preview/StatCard';

interface ActionRow {
  when: string;
  who: string;
  action: string;
  candidate: string;
}

const ACTIONS: ActionRow[] = [
  { when: '2 hours ago', who: 'Sarah L.', action: 'I-9 Section 2 completed', candidate: 'Marcus Chen' },
  { when: 'Today, 9:14 AM', who: 'E-Verify (auto)', action: 'Case opened', candidate: 'Marcus Chen' },
  { when: 'Yesterday', who: 'Raj K.', action: 'I-983 submitted to DSO', candidate: 'Aisha Patel' },
  { when: '2 days ago', who: 'You', action: 'Document retention review', candidate: '(4 records)' },
  { when: '3 days ago', who: 'Sarah L.', action: 'Offer letter signed', candidate: 'Lin Zhou' },
];

interface Upcoming {
  label: string;
  detail: string;
  badge: { text: string; color: string };
}

const UPCOMING: Upcoming[] = [
  { label: 'I-9 deadline: Marcus Chen', detail: 'May 22 (in 3 days)', badge: { text: '3d', color: 'bg-amber-100 text-amber-800' } },
  { label: 'DSO follow-up: Priya Sharma', detail: 'May 24', badge: { text: '5d', color: 'bg-blue-100 text-blue-800' } },
  { label: 'Quarterly audit prep', detail: 'May 31', badge: { text: '12d', color: 'bg-gray-200 text-gray-700' } },
];

export default function HrCompliancePage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="Compliance Overview">
        <PreviewShell>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="I-9 Pending" value={5} icon={ShieldCheck} />
            <StatCard
              label="I-9 Overdue"
              value={1}
              icon={AlertTriangle}
              trend={{ direction: 'down', value: 'action needed' }}
            />
            <StatCard label="E-Verify Open Cases" value={3} icon={BadgeCheck} />
            <StatCard label="Days Until Audit" value={47} icon={CalendarClock} />
          </div>

          <section className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" strokeWidth={2} />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900">
                  1 candidate has an overdue I-9
                </h3>
                <p className="mt-1 text-sm text-red-800">
                  Priya Sharma&apos;s I-9 deadline was May 17. Required action: complete
                  Section 2 immediately to remain compliant.
                </p>
                <div className="mt-3">
                  <MockButton variant="danger">Resolve Now</MockButton>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Recent Compliance Actions</h3>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Who</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Candidate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ACTIONS.map((a, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{a.when}</td>
                      <td className="px-4 py-3 text-gray-700">{a.who}</td>
                      <td className="px-4 py-3 text-gray-900">{a.action}</td>
                      <td className="px-4 py-3 text-gray-700">{a.candidate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Coming up this week</h3>
            <ul className="space-y-2">
              {UPCOMING.map((u) => (
                <li
                  key={u.label}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{u.label}</div>
                    <div className="text-xs text-gray-500">{u.detail}</div>
                  </div>
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + u.badge.color}>
                    {u.badge.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </PreviewShell>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
