'use client';

import { AlertTriangle, CheckCircle, Clock, FilePlus, XCircle } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';
import StatCard from '@/components/preview/StatCard';

type OfferStatus =
  | 'Pending Signature'
  | 'Accepted'
  | 'Pending Candidate Response'
  | 'Declined';

interface Offer {
  candidate: string;
  position: string;
  entity: string;
  stipend: string;
  status: OfferStatus;
  deadline: string;
}

const OFFERS: Offer[] = [
  { candidate: 'Marcus Chen', position: 'Frontend Dev Intern', entity: 'Stellar USA', stipend: '$2,800/mo', status: 'Pending Signature', deadline: 'May 24, 2026' },
  { candidate: 'Aisha Patel', position: 'Cloud Eng Intern', entity: 'Skyzen', stipend: '$3,200/mo', status: 'Accepted', deadline: '—' },
  { candidate: 'Jamal Williams', position: 'Backend Dev Intern', entity: 'CEO Foundry', stipend: '$2,500/mo', status: 'Pending Candidate Response', deadline: 'May 26, 2026' },
  { candidate: 'Lin Zhou', position: 'Frontend Dev Intern', entity: 'Stellar USA', stipend: '$2,800/mo', status: 'Accepted', deadline: '—' },
  { candidate: 'Devon King', position: 'Backend Dev Intern', entity: 'Blueera', stipend: '$2,600/mo', status: 'Declined', deadline: 'May 18, 2026' },
];

const STATUS_CLASS: Record<OfferStatus, string> = {
  'Pending Signature': 'bg-amber-100 text-amber-800',
  Accepted: 'bg-green-100 text-green-800',
  'Pending Candidate Response': 'bg-amber-100 text-amber-800',
  Declined: 'bg-red-100 text-red-700',
};

export default function HrOffersPage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'ADMIN', 'ERM']}>
      <DashboardLayout title="Offer Letters">
        <PreviewShell>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Track all outstanding and recent offers across staffing entities.
            </p>
            <MockButton icon={<FilePlus className="h-4 w-4" />}>
              Generate New Offer
            </MockButton>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Pending Acceptance" value={4} icon={Clock} />
            <StatCard label="Accepted (30d)" value={8} icon={CheckCircle} trend={{ direction: 'up', value: '+2 vs prev 30d' }} />
            <StatCard label="Declined (30d)" value={1} icon={XCircle} />
            <StatCard label="Expiring Soon" value={2} icon={AlertTriangle} />
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Stipend</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {OFFERS.map((o) => (
                  <tr key={o.candidate} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.candidate}</td>
                    <td className="px-4 py-3 text-gray-700">{o.position}</td>
                    <td className="px-4 py-3 text-gray-700">{o.entity}</td>
                    <td className="px-4 py-3 text-gray-700">{o.stipend}</td>
                    <td className="px-4 py-3">
                      <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ' + STATUS_CLASS[o.status]}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{o.deadline}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {o.status === 'Pending Signature' && (
                          <>
                            <MockButton variant="secondary">Resend</MockButton>
                            <MockButton variant="secondary">View PDF</MockButton>
                          </>
                        )}
                        {o.status === 'Accepted' && (
                          <MockButton variant="secondary">View Signed</MockButton>
                        )}
                        {o.status === 'Pending Candidate Response' && (
                          <MockButton variant="secondary">Send Reminder</MockButton>
                        )}
                        {o.status === 'Declined' && (
                          <MockButton variant="ghost">Reason</MockButton>
                        )}
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
