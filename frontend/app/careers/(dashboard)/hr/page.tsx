'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-context';

export default function HrDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="HR Dashboard">
        <HrBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function HrBody() {
  const { user } = useAuth();
  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </h2>
      <p className="mb-6 text-sm text-gray-600">
        I-9 verifications, E-Verify cases, and I-983 review queue.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="I-9 pending" body="Form I-9 verifications awaiting completion." />
        <Card title="I-983 reviews" body="Training plans pending HR review." />
        <Card title="E-Verify cases" body="Active and pending E-Verify cases." />
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
