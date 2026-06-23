'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Ban, CheckCircle2, KeyRound, Plus, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useMailAuth } from '../_providers/MailAuthProvider';
import CreateMailboxModal from './_components/CreateMailboxModal';
import CredentialsModal from './_components/CredentialsModal';
import {
  listDomains,
  listMailboxes,
  mailErrorMessage,
  reactivateMailbox,
  resetMailboxPassword,
  setMailboxRole,
  suspendMailbox,
  type MailCredentialResponse,
  type MailDomainResponse,
  type MailMailboxResponse,
} from '@/lib/mail-client';

const SUPER_ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN'];
const ADMIN_ROLES = ['USER', 'ADMIN'];

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ' +
        (active
          ? 'bg-green-50 text-green-700 ring-green-200'
          : 'bg-amber-50 text-amber-700 ring-amber-200')
      }
    >
      {status}
    </span>
  );
}

type ConfirmState = { kind: 'reset' | 'suspend' | 'reactivate'; mb: MailMailboxResponse };

export default function MailboxesPage() {
  const { account } = useMailAuth();
  const isSuper = account?.role === 'SUPER_ADMIN';

  const [mailboxes, setMailboxes] = useState<MailMailboxResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [domainId, setDomainId] = useState('');
  const [domains, setDomains] = useState<MailDomainResponse[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [credential, setCredential] = useState<MailCredentialResponse | null>(null);
  const [credentialTitle, setCredentialTitle] = useState('Mailbox created');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  // Domains list (SUPER_ADMIN only — drives the filter + the create picker).
  useEffect(() => {
    if (!isSuper) return;
    listDomains()
      .then(setDomains)
      .catch((e) => toast.error(mailErrorMessage(e, 'Failed to load domains')));
  }, [isSuper]);

  // Mailboxes — debounced reload on any filter change or explicit reload.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await listMailboxes({
          search: search || undefined,
          status: status || undefined,
          domainId: domainId || undefined,
        });
        if (!cancelled) setMailboxes(data);
      } catch (e) {
        if (!cancelled) toast.error(mailErrorMessage(e, 'Failed to load mailboxes'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, status, domainId, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  const fixedDomainId = account?.domainId ?? null;
  const fixedDomainName = account?.email?.includes('@')
    ? account.email.split('@')[1]
    : '';

  async function runConfirm() {
    if (!confirm) return;
    const { kind, mb } = confirm;
    try {
      if (kind === 'reset') {
        const cred = await resetMailboxPassword(mb.accountId);
        setCredentialTitle('Password reset');
        setCredential(cred);
      } else if (kind === 'suspend') {
        await suspendMailbox(mb.accountId);
        toast.success(`Suspended ${mb.email}`);
      } else {
        await reactivateMailbox(mb.accountId);
        toast.success(`Reactivated ${mb.email}`);
      }
      reload();
    } catch (e) {
      toast.error(mailErrorMessage(e));
    } finally {
      setConfirm(null);
    }
  }

  async function onRoleChange(mb: MailMailboxResponse, newRole: string) {
    if (newRole === mb.role) return;
    try {
      await setMailboxRole(mb.accountId, newRole);
      toast.success(`Updated role for ${mb.email}`);
    } catch (e) {
      toast.error(mailErrorMessage(e));
    } finally {
      reload(); // refetch so the select reflects the true server state
    }
  }

  const confirmCopy: Record<ConfirmState['kind'], { title: string; description: string; label: string; danger: boolean }> = {
    reset: {
      title: 'Reset password?',
      description: confirm ? `A new one-time password will be generated for ${confirm.mb.email}. Their current password stops working immediately.` : '',
      label: 'Reset password',
      danger: false,
    },
    suspend: {
      title: 'Suspend mailbox?',
      description: confirm ? `${confirm.mb.email} will be unable to sign in and all their sessions are revoked.` : '',
      label: 'Suspend',
      danger: true,
    },
    reactivate: {
      title: 'Reactivate mailbox?',
      description: confirm ? `${confirm.mb.email} will be able to sign in again.` : '',
      label: 'Reactivate',
      danger: false,
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Mailboxes</h1>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Create mailbox
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search local part or name…"
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        {isSuper && (
          <select
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={reload}
        >
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Name</th>
              {isSuper && <th className="px-4 py-2 font-medium">Domain</th>}
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={isSuper ? 6 : 5} className="px-4 py-10 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : mailboxes.length === 0 ? (
              <tr>
                <td colSpan={isSuper ? 6 : 5} className="px-4 py-10 text-center text-slate-500">
                  No mailboxes found.
                </td>
              </tr>
            ) : (
              mailboxes.map((mb) => {
                const roleLocked = !isSuper && mb.role === 'SUPER_ADMIN';
                const roleOptions = isSuper ? SUPER_ROLES : ADMIN_ROLES;
                const suspended = mb.status === 'SUSPENDED';
                return (
                  <tr key={mb.accountId} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{mb.email}</td>
                    <td className="px-4 py-2 text-slate-600">{mb.displayName ?? '—'}</td>
                    {isSuper && <td className="px-4 py-2 text-slate-600">{mb.domainName}</td>}
                    <td className="px-4 py-2">
                      <select
                        value={mb.role}
                        disabled={roleLocked}
                        onChange={(e) => void onRoleChange(mb, e.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        {/* Ensure the current value is always selectable even if outside the options. */}
                        {!roleOptions.includes(mb.role) && (
                          <option value={mb.role}>{mb.role}</option>
                        )}
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={mb.status} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<KeyRound className="h-4 w-4" />}
                          onClick={() => setConfirm({ kind: 'reset', mb })}
                        >
                          Reset
                        </Button>
                        {suspended ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<CheckCircle2 className="h-4 w-4" />}
                            onClick={() => setConfirm({ kind: 'reactivate', mb })}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Ban className="h-4 w-4" />}
                            onClick={() => setConfirm({ kind: 'suspend', mb })}
                          >
                            Suspend
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <CreateMailboxModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        isSuper={!!isSuper}
        domains={domains}
        fixedDomainId={fixedDomainId}
        fixedDomainName={fixedDomainName}
        onCreated={(cred) => {
          setCreateOpen(false);
          setCredentialTitle('Mailbox created');
          setCredential(cred);
          reload();
        }}
      />

      <CredentialsModal
        credential={credential}
        title={credentialTitle}
        onClose={() => setCredential(null)}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        title={confirm ? confirmCopy[confirm.kind].title : ''}
        description={confirm ? confirmCopy[confirm.kind].description : undefined}
        confirmLabel={confirm ? confirmCopy[confirm.kind].label : 'Confirm'}
        variant={confirm && confirmCopy[confirm.kind].danger ? 'danger' : 'primary'}
      />
    </div>
  );
}
