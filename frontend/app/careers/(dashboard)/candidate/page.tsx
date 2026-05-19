'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-context';

export default function CandidateDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="Dashboard">
        <CandidateDashboardBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function CandidateDashboardBody() {
  const { user } = useAuth();
  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </h2>
      <p className="mb-6 text-sm text-gray-600">
        Track your applications, manage your resumes, and discover new internships.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Browse open positions" body="Explore internships matched to your skills." />
        <Card title="My applications" body="Track the status of your active applications." />
      </div>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-2 font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}
