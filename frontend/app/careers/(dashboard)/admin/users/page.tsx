'use client';

import { Briefcase, UserCheck, UserCircle, UserPlus, Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PreviewShell from '@/components/preview/PreviewShell';
import MockButton from '@/components/preview/MockButton';
import StatCard from '@/components/preview/StatCard';

type Role = 'CANDIDATE' | 'RECRUITER' | 'ERM' | 'HR' | 'EVALUATOR' | 'ADMIN';

interface User {
  name: string;
  email: string;
  role: Role;
  status: 'Active' | 'Disabled';
  lastLogin: string;
  joined: string;
  isYou?: boolean;
}

const USERS: User[] = [
  { name: 'Priya Sharma', email: 'priya.sharma@example.com', role: 'CANDIDATE', status: 'Active', lastLogin: '2 hours ago', joined: 'Apr 25, 2026' },
  { name: 'Marcus Chen', email: 'marcus.chen@example.com', role: 'CANDIDATE', status: 'Active', lastLogin: 'Yesterday', joined: 'May 1, 2026' },
  { name: 'Sarah Lopez', email: 'sarah.lopez@skyzen.com', role: 'HR', status: 'Active', lastLogin: 'Today, 9:14 AM', joined: 'Jan 12, 2026' },
  { name: 'Raj Kumar', email: 'raj.kumar@skyzen.com', role: 'ERM', status: 'Active', lastLogin: 'Today, 11:30 AM', joined: 'Mar 3, 2026' },
  { name: 'You (admin)', email: 'admin@skyzen.test', role: 'ADMIN', status: 'Active', lastLogin: 'Just now', joined: 'Mar 1, 2026', isYou: true },
  { name: 'Diane Ortiz', email: 'diane.ortiz@skyzen.com', role: 'EVALUATOR', status: 'Active', lastLogin: 'Yesterday', joined: 'Feb 14, 2026' },
  { name: 'Tom Bennett', email: 'tom.bennett@skyzen.com', role: 'RECRUITER', status: 'Disabled', lastLogin: '2 weeks ago', joined: 'Jan 8, 2026' },
];

const ROLE_CLASS: Record<Role, string> = {
  CANDIDATE: 'bg-blue-100 text-blue-800',
  RECRUITER: 'bg-purple-100 text-purple-800',
  ERM: 'bg-indigo-100 text-indigo-800',
  HR: 'bg-green-100 text-green-800',
  EVALUATOR: 'bg-amber-100 text-amber-800',
  ADMIN: 'bg-red-100 text-red-800',
};

export default function AdminUsersPage() {
  return (
    <ProtectedRoute requiredRoles={['ADMIN']}>
      <DashboardLayout title="Users">
        <PreviewShell>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                placeholder="Search users..."
                className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <select className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
                <option>All roles</option>
                <option>CANDIDATE</option>
                <option>RECRUITER</option>
                <option>ERM</option>
                <option>HR</option>
                <option>EVALUATOR</option>
                <option>ADMIN</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <MockButton icon={<UserPlus className="h-4 w-4" />}>Invite User</MockButton>
              <MockButton variant="secondary">Export CSV</MockButton>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Users" value={47} icon={Users} />
            <StatCard label="Active (last 30d)" value={38} icon={UserCheck} trend={{ direction: 'up', value: '+4 vs prev 30d' }} />
            <StatCard label="Candidates" value={28} icon={UserCircle} />
            <StatCard label="Internal Staff" value={19} icon={Briefcase} />
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {USERS.map((u) => (
                  <tr key={u.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.name}
                      {u.isYou && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ' + ROLE_CLASS[u.role]}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                          (u.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-200 text-gray-700')
                        }
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.lastLogin}</td>
                    <td className="px-4 py-3 text-gray-700">{u.joined}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <MockButton variant="ghost">Edit</MockButton>
                        {u.status === 'Active' ? (
                          <MockButton variant="ghost">Disable</MockButton>
                        ) : (
                          <MockButton variant="secondary">Re-enable</MockButton>
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
