'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-context';

export default function EvaluatorDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['TECHNICAL_EVALUATOR', 'ADMIN']}>
      <DashboardLayout title="Evaluator Dashboard">
        <EvaluatorBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function EvaluatorBody() {
  const { user } = useAuth();
  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900">
        Welcome{user ? `, ${user.fullName}` : ''}.
      </h2>
      <p className="mb-6 text-sm text-gray-600">
        Track your assigned interns, sessions, and weekly assignments.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="My interns" body="Interns assigned to you for technical evaluation." />
        <Card title="This week's assignments" body="Reviews and evaluations due this week." />
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
