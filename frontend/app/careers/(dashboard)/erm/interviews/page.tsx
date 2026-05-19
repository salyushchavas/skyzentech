'use client';

import { useState } from 'react';
import { Video, Plus } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';

type InterviewStatus = 'Scheduled' | 'Pending Confirmation' | 'Completed';

interface Interview {
  candidate: string;
  position: string;
  scheduled: string;
  interviewer: string;
  status: InterviewStatus;
  primaryAction: 'join' | 'reminder';
  showReschedule?: boolean;
}

const UPCOMING: Interview[] = [
  { candidate: 'Priya Sharma', position: 'Backend Developer Intern', scheduled: 'Tomorrow 10:00 AM EST', interviewer: 'You (Raj K.)', status: 'Scheduled', primaryAction: 'join', showReschedule: true },
  { candidate: 'Marcus Chen', position: 'Frontend Developer Intern', scheduled: 'Tomorrow 2:00 PM EST', interviewer: 'You', status: 'Scheduled', primaryAction: 'join' },
  { candidate: 'Aisha Patel', position: 'Cloud Engineer Intern', scheduled: 'May 22, 11:00 AM EST', interviewer: 'Sarah L.', status: 'Scheduled', primaryAction: 'join' },
  { candidate: 'Jamal Williams', position: 'Backend Developer Intern', scheduled: 'May 23, 9:00 AM EST', interviewer: 'You', status: 'Pending Confirmation', primaryAction: 'reminder' },
];

interface PastInterview {
  candidate: string;
  position: string;
  date: string;
  score: string;
}

const PAST: PastInterview[] = [
  { candidate: 'Lin Zhou', position: 'Frontend Developer Intern', date: 'May 15, 2026', score: '4.5/5' },
  { candidate: 'Devon King', position: 'Backend Developer Intern', date: 'May 13, 2026', score: '4.0/5' },
];

const STATUS_CLASS: Record<InterviewStatus, string> = {
  Scheduled: 'bg-blue-100 text-blue-800',
  'Pending Confirmation': 'bg-amber-100 text-amber-800',
  Completed: 'bg-green-100 text-green-800',
};

type Filter = 'upcoming' | 'past' | 'all';

export default function ErmInterviewsPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'ADMIN']}>
      <DashboardLayout title="Interviews">
        <PreviewShell>
          <Body />
        </PreviewShell>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const [filter, setFilter] = useState<Filter>('upcoming');

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <FilterPills value={filter} onChange={setFilter} />
        <MockButton icon={<Plus className="h-4 w-4" />}>Schedule New Interview</MockButton>
      </div>

      {(filter === 'upcoming' || filter === 'all') && (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Upcoming Interviews</h3>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Interviewer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {UPCOMING.map((i) => (
                  <tr key={i.candidate} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{i.candidate}</td>
                    <td className="px-4 py-3 text-gray-700">{i.position}</td>
                    <td className="px-4 py-3 text-gray-700">{i.scheduled}</td>
                    <td className="px-4 py-3 text-gray-700">{i.interviewer}</td>
                    <td className="px-4 py-3">
                      <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ' + STATUS_CLASS[i.status]}>
                        {i.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {i.primaryAction === 'join' ? (
                          <MockButton icon={<Video className="h-3.5 w-3.5" />}>Join Meet</MockButton>
                        ) : (
                          <MockButton variant="secondary">Send Reminder</MockButton>
                        )}
                        {i.showReschedule && (
                          <MockButton variant="secondary">Reschedule</MockButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(filter === 'past' || filter === 'all') && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Past Interviews — Last 7 days</h3>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Feedback Score</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PAST.map((p) => (
                  <tr key={p.candidate} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.candidate}</td>
                    <td className="px-4 py-3 text-gray-700">{p.position}</td>
                    <td className="px-4 py-3 text-gray-700">{p.date}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        ⭐ {p.score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MockButton variant="secondary">View Notes</MockButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function FilterPills({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
}) {
  const opts: { key: Filter; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
  ];
  return (
    <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={
            'rounded px-3 py-1 text-xs font-medium transition-colors ' +
            (value === o.key
              ? 'bg-accent text-white'
              : 'text-gray-600 hover:bg-gray-100')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
