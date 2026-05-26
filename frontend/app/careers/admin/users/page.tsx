'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, MoreHorizontal, Plus, Search, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { formatDateOnly } from '@/lib/format-date';
import type { Uuid, UserRole } from '@/types';

interface AdminUserResponse {
  id: Uuid;
  name: string;
  email: string;
  roles: UserRole[];
  active: boolean;
  createdAt: string;
  applicantId?: string | null;
}

/** Matches the backend's LAST_SUPER_ADMIN_MSG so we can render this as the
 *  blocked-state banner instead of a passing toast. */
const LAST_SUPER_ADMIN_FRAGMENT = 'last active SUPER_ADMIN';

// PED §7 + SUPER_ADMIN split — STAFF_ROLES are the five roles a SUPER_ADMIN
// can assign via this UI. APPLICANT and INTERN are NOT in the picker — those
// are set by candidate registration and the engagement-activation role flip,
// not by admin-side assignment.
const STAFF_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'OPERATIONS',
  'HR_COMPLIANCE',
  'TECHNICAL_SUPERVISOR',
  'EXECUTIVE',
];

const ROLE_LABEL: Record<UserRole, string> = {
  APPLICANT: 'Applicant',
  INTERN: 'Intern',
  OPERATIONS: 'Operations',
  HR_COMPLIANCE: 'HR / Compliance',
  TECHNICAL_SUPERVISOR: 'Technical Supervisor',
  EXECUTIVE: 'Executive',
  SUPER_ADMIN: 'Super admin',
};

const ROLE_COLOR: Record<UserRole, string> = {
  APPLICANT: 'bg-gray-100 text-gray-700',
  INTERN: 'bg-sky-100 text-sky-800',
  OPERATIONS: 'bg-rose-100 text-rose-800',
  HR_COMPLIANCE: 'bg-emerald-100 text-emerald-800',
  TECHNICAL_SUPERVISOR: 'bg-amber-100 text-amber-800',
  EXECUTIVE: 'bg-violet-100 text-violet-800',
  SUPER_ADMIN: 'bg-indigo-100 text-indigo-800',
};

// Show SUPER_ADMIN first if present (god-mode); then OPERATIONS; then any
// other non-candidate-side role; otherwise just the first.
const CANDIDATE_SIDE: UserRole[] = ['APPLICANT', 'INTERN'];

function primaryRole(roles: UserRole[] | null | undefined): UserRole {
  if (!roles || roles.length === 0) return 'APPLICANT';
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (roles.includes('OPERATIONS')) return 'OPERATIONS';
  const staff = roles.find((r) => !CANDIDATE_SIDE.includes(r));
  return staff ?? roles[0];
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        ROLE_COLOR[role]
      }
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

export default function AdminUsersPage() {
  return (
    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
      <DashboardLayout title="Users">
        <UsersTable />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function UsersTable() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [menuFor, setMenuFor] = useState<Uuid | null>(null);
  const [changingRoleFor, setChangingRoleFor] = useState<AdminUserResponse | null>(null);
  const [confirmingDeactivateFor, setConfirmingDeactivateFor] =
    useState<AdminUserResponse | null>(null);
  // Surfaces the last-active-SUPER_ADMIN refusal as a persistent banner the
  // operator has to dismiss — not a passing toast.
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<AdminUserResponse[]>('/api/v1/admin/users');
      setUsers(res.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load users.");
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const role = primaryRole(u.roles);
      if (roleFilter !== 'ALL' && role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const setStatus = useCallback(
    async (u: AdminUserResponse, nextActive: boolean) => {
      // Optimistic update — rolled back on error.
      setUsers((curr) =>
        curr ? curr.map((x) => (x.id === u.id ? { ...x, active: nextActive } : x)) : curr,
      );
      setMenuFor(null);
      try {
        await api.put(`/api/v1/admin/users/${u.id}/status`, { active: nextActive });
        setToast(nextActive ? 'User activated.' : 'User deactivated.');
      } catch (err: any) {
        // Rollback optimistic state.
        setUsers((curr) =>
          curr ? curr.map((x) => (x.id === u.id ? { ...x, active: u.active } : x)) : curr,
        );
        const status = err?.response?.status;
        const msg = err?.response?.data?.error ?? 'Could not update status.';
        if (status === 409 && msg.includes(LAST_SUPER_ADMIN_FRAGMENT)) {
          // The brief's "clear blocked state, not a server error" — render
          // as a persistent banner the SA has to acknowledge.
          setBlockedMessage(msg);
        } else {
          setToast(msg);
        }
      }
    },
    [],
  );

  // Activate is fire-and-forget; deactivate gates through a confirm modal.
  const activate = (u: AdminUserResponse) => void setStatus(u, true);
  const askDeactivate = (u: AdminUserResponse) => {
    setMenuFor(null);
    setConfirmingDeactivateFor(u);
  };

  return (
    <section>
      {blockedMessage && (
        <div className="mb-4 flex items-start gap-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <div className="flex-1">
            <div className="font-semibold">Blocked by policy</div>
            <div className="mt-0.5 text-red-700">{blockedMessage}</div>
          </div>
          <button
            type="button"
            onClick={() => setBlockedMessage(null)}
            className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {toast && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Filter:
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="ALL">All roles</option>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          New user
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {users === null ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">
          {users.length === 0 ? 'No users found.' : 'No users match those filters.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Applicant ID</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const role = primaryRole(u.roles);
                const isSelf = me?.userId === u.id;
                return (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link
                        href={`/careers/admin/users/${u.id}/supervision`}
                        className="hover:text-accent-dark hover:underline"
                      >
                        {u.name ?? '—'}
                      </Link>
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-gray-500">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={role} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex items-center gap-1.5 text-sm ' +
                          (u.active ? 'text-emerald-700' : 'text-gray-500')
                        }
                      >
                        <span
                          className={
                            'h-2 w-2 rounded-full ' +
                            (u.active ? 'bg-emerald-500' : 'bg-gray-400')
                          }
                        />
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {u.applicantId ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {u.createdAt ? formatDateOnly(u.createdAt) : '—'}
                    </td>
                    <td className="relative px-4 py-3 text-right">
                      <button
                        type="button"
                        aria-label="Row actions"
                        onClick={() => setMenuFor((curr) => (curr === u.id ? null : u.id))}
                        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100"
                      >
                        <MoreHorizontal className="h-4 w-4 text-gray-600" />
                      </button>
                      {menuFor === u.id && (
                        <div className="absolute right-4 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white text-left shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuFor(null);
                              setChangingRoleFor(u);
                            }}
                            disabled={isSelf}
                            className="block w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Change role
                          </button>
                          <button
                            type="button"
                            onClick={() => (u.active ? askDeactivate(u) : activate(u))}
                            disabled={isSelf}
                            className="block w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <NewUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setToast('User created.');
            void load();
          }}
        />
      )}

      {changingRoleFor && (
        <ChangeRoleModal
          target={changingRoleFor}
          onClose={() => setChangingRoleFor(null)}
          onSaved={() => {
            setChangingRoleFor(null);
            setToast('Role updated.');
            void load();
          }}
          onBlocked={(msg) => {
            setChangingRoleFor(null);
            setBlockedMessage(msg);
          }}
        />
      )}

      {confirmingDeactivateFor && (
        <ConfirmDeactivateModal
          target={confirmingDeactivateFor}
          onCancel={() => setConfirmingDeactivateFor(null)}
          onConfirm={async () => {
            const u = confirmingDeactivateFor;
            setConfirmingDeactivateFor(null);
            await setStatus(u, false);
          }}
        />
      )}
    </section>
  );
}

function NewUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('OPERATIONS');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email, and password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/v1/admin/users', {
        name: name.trim(),
        email: email.trim(),
        role,
        initialPassword: password,
      });
      onCreated();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (status === 409) {
        setError(msg ?? 'A user with that email already exists.');
      } else if (status === 400) {
        setError(msg ?? 'Some fields are invalid.');
      } else {
        setError(msg ?? 'Could not create user.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">New user</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Initial password <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Share this with the user; they can change it from their account later.
            </p>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeRoleModal({
  target,
  onClose,
  onSaved,
  onBlocked,
}: {
  target: AdminUserResponse;
  onClose: () => void;
  onSaved: () => void;
  onBlocked: (msg: string) => void;
}) {
  const current = primaryRole(target.roles);
  const [role, setRole] = useState<UserRole>(STAFF_ROLES.includes(current) ? current : 'OPERATIONS');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.put(`/api/v1/admin/users/${target.id}/role`, { role });
      onSaved();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error ?? 'Could not update role.';
      if (status === 409 && msg.includes(LAST_SUPER_ADMIN_FRAGMENT)) {
        // Escalate to the parent's blocked-state banner and close the modal —
        // the action isn't a "retryable" inline error, it's a policy refusal.
        onBlocked(msg);
        return;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-lg font-semibold text-gray-900">Change role</h3>
        <p className="mb-4 text-xs text-gray-500">
          {target.name} · {target.email}
        </p>
        <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeactivateModal({
  target,
  onCancel,
  onConfirm,
}: {
  target: AdminUserResponse;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isSuperAdmin = target.roles?.includes('SUPER_ADMIN');
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertCircle className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Deactivate user</h3>
            <p className="mt-1 text-sm text-gray-600">
              {target.name} <span className="text-gray-400">·</span> {target.email}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          Deactivated users can&apos;t sign in. You can reactivate the account later;
          their data isn&apos;t deleted.
        </p>
        {isSuperAdmin && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            This is a SUPER_ADMIN account — if they&apos;re the only active one,
            this will be blocked.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              setSubmitting(true);
              await onConfirm();
              // Parent unmounts this modal; no need to reset state.
            }}
            disabled={submitting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {submitting ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}
