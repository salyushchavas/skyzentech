'use client';

import { useState } from 'react';
import { Plus, Video } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';

interface Upcoming {
  when: string;
  intern: string;
  topic: string;
  showNotes?: boolean;
}

const UPCOMING: Upcoming[] = [
  { when: 'Tomorrow, 3:00 PM EST', intern: 'Lin Zhou', topic: 'Week 5 Check-in', showNotes: true },
  { when: 'Friday, May 23, 10:00 AM', intern: 'Aisha Patel', topic: 'Week 3 Check-in' },
  { when: 'Monday, May 26, 2:00 PM', intern: 'Marcus Chen', topic: 'Week 4 Check-in' },
];

interface Past {
  date: string;
  intern: string;
  topic: string;
  rating: string;
}

const PAST: Past[] = [
  { date: 'May 10', intern: 'Lin Zhou', topic: 'Week 3 Session', rating: '4.5' },
  { date: 'May 8', intern: 'Marcus Chen', topic: 'Week 2 Session', rating: '4.6' },
  { date: 'May 6', intern: 'Aisha Patel', topic: 'Week 1 Session', rating: '4.0' },
];

type Filter = 'upcoming' | 'past' | 'all';

export default function EvaluatorSessionsPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_EVALUATOR', 'ADMIN']}>
      <DashboardLayout title="Biweekly Sessions">
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
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
          {(
            [
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'past', label: 'Past' },
              { key: 'all', label: 'All' },
            ] as { key: Filter; label: string }[]
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setFilter(o.key)}
              className={
                'rounded px-3 py-1 text-xs font-medium transition-colors ' +
                (filter === o.key
                  ? 'bg-accent text-white'
                  : 'text-gray-600 hover:bg-gray-100')
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        <MockButton icon={<Plus className="h-4 w-4" />}>Schedule Session</MockButton>
      </div>

      {(filter === 'upcoming' || filter === 'all') && (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Upcoming</h3>
          <ul className="space-y-3">
            {UPCOMING.map((u, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-900">{u.when}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    <span className="font-medium text-gray-900">{u.intern}</span>
                    {' — '}
                    {u.topic}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MockButton icon={<Video className="h-3.5 w-3.5" />}>Join Meet</MockButton>
                  {u.showNotes && <MockButton variant="secondary">Notes</MockButton>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(filter === 'past' || filter === 'all') && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Past Sessions</h3>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Intern</th>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PAST.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{p.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.intern}</td>
                    <td className="px-4 py-3 text-gray-700">{p.topic}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        ⭐ {p.rating}
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
