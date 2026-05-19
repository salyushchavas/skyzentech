'use client';

import { CalendarClock, ClipboardList, Star, Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';
import StatCard from '@/components/preview/StatCard';

interface Intern {
  initials: string;
  name: string;
  position: string;
  weekOf: number;
  totalWeeks: number;
  rating: number;
}

const INTERNS: Intern[] = [
  { initials: 'LZ', name: 'Lin Zhou', position: 'Frontend Dev Intern', weekOf: 5, totalWeeks: 12, rating: 4.5 },
  { initials: 'AP', name: 'Aisha Patel', position: 'Cloud Eng Intern', weekOf: 3, totalWeeks: 12, rating: 4.2 },
  { initials: 'MC', name: 'Marcus Chen', position: 'Frontend Dev Intern', weekOf: 4, totalWeeks: 12, rating: 4.7 },
  { initials: 'DK', name: 'Devon King', position: 'Backend Dev Intern', weekOf: 8, totalWeeks: 12, rating: 4.0 },
  { initials: 'PS', name: 'Priya Sharma', position: 'Backend Dev Intern', weekOf: 2, totalWeeks: 12, rating: 4.3 },
  { initials: 'JW', name: 'Jamal Williams', position: 'Backend Dev Intern', weekOf: 6, totalWeeks: 12, rating: 4.4 },
];

export default function EvaluatorInternsPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_EVALUATOR', 'ADMIN']}>
      <DashboardLayout title="My Interns">
        <PreviewShell>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Interns" value={6} icon={Users} />
            <StatCard label="Assignments Due" value={4} icon={ClipboardList} />
            <StatCard label="Avg Rating" value="4.3 / 5" icon={Star} trend={{ direction: 'up', value: '+0.2 vs last 30d' }} />
            <StatCard label="Sessions This Week" value={3} icon={CalendarClock} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {INTERNS.map((i) => {
              const pct = Math.round((i.weekOf / i.totalWeeks) * 100);
              return (
                <article
                  key={i.name}
                  className="rounded-lg border border-gray-200 bg-white p-5"
                >
                  <header className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                      {i.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-900">{i.name}</div>
                      <div className="truncate text-xs text-gray-500">{i.position}</div>
                    </div>
                  </header>

                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                      <span>Week {i.weekOf} of {i.totalWeeks}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="mb-4 text-xs text-gray-600">
                    Latest rating: <span className="font-medium text-gray-900">⭐ {i.rating}/5</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <MockButton variant="secondary">View Profile</MockButton>
                    <MockButton variant="secondary">Assignments</MockButton>
                    <MockButton variant="secondary">Sessions</MockButton>
                  </div>
                </article>
              );
            })}
          </div>
        </PreviewShell>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
