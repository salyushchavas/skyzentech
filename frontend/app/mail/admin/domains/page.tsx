'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useMailAuth } from '../../_providers/MailAuthProvider';
import {
  createDomain,
  deleteDomain,
  listDomains,
  mailErrorMessage,
  updateDomain,
  type MailDomainResponse,
} from '@/lib/mail-client';

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ' +
        (active
          ? 'bg-green-50 text-green-700 ring-green-200'
          : 'bg-slate-100 text-slate-500 ring-slate-200')
      }
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function DomainsPage() {
  const router = useRouter();
  const { account } = useMailAuth();
  const isSuper = account?.role === 'SUPER_ADMIN';

  const [domains, setDomains] = useState<MailDomainResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<MailDomainResponse | null>(null);

  // Domains are SUPER_ADMIN-only; an ADMIN that lands here is sent back.
  useEffect(() => {
    if (account && !isSuper) router.replace('/mail/admin');
  }, [account, isSuper, router]);

  useEffect(() => {
    if (!isSuper) return;
    let cancelled = false;
    setLoading(true);
    listDomains()
      .then((d) => {
        if (!cancelled) setDomains(d);
      })
      .catch((e) => {
        if (!cancelled) toast.error(mailErrorMessage(e, 'Failed to load domains'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuper, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Domain name is required.');
      return;
    }
    setCreating(true);
    try {
      await createDomain(name.trim(), displayName.trim() || undefined);
      toast.success(`Created ${name.trim().toLowerCase()}`);
      setName('');
      setDisplayName('');
      reload();
    } catch (err) {
      toast.error(mailErrorMessage(err, 'Could not create domain'));
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(d: MailDomainResponse) {
    try {
      await updateDomain(d.id, { active: !d.active });
      toast.success(`${d.name} ${d.active ? 'deactivated' : 'activated'}`);
      reload();
    } catch (err) {
      toast.error(mailErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteDomain(toDelete.id);
      toast.success(`Deleted ${toDelete.name}`);
      reload();
    } catch (err) {
      toast.error(mailErrorMessage(err));
    } finally {
      setToDelete(null);
    }
  }

  if (account && !isSuper) {
    return <div className="py-16 text-center text-sm text-slate-500">Redirecting…</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Domains</h1>

      {/* Create */}
      <form
        onSubmit={onCreate}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="w-full sm:w-56">
          <label className="mb-1 block text-xs font-semibold text-slate-700">Domain name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="example.com" />
        </div>
        <div className="w-full sm:w-56">
          <label className="mb-1 block text-xs font-semibold text-slate-700">Display name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Example Inc."
          />
        </div>
        <Button type="submit" loading={creating} leftIcon={<Plus className="h-4 w-4" />}>
          Add domain
        </Button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Domain</th>
              <th className="px-4 py-2 font-medium">Display name</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Mailboxes</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : domains.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No domains yet.
                </td>
              </tr>
            ) : (
              domains.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{d.name}</td>
                  <td className="px-4 py-2 text-slate-600">{d.displayName ?? '—'}</td>
                  <td className="px-4 py-2">
                    <ActiveBadge active={d.active} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">{d.accountCount}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Power className="h-4 w-4" />}
                        onClick={() => void toggleActive(d)}
                      >
                        {d.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        disabled={d.accountCount > 0}
                        title={d.accountCount > 0 ? 'Domain has mailboxes — deactivate instead' : undefined}
                        onClick={() => setToDelete(d)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete domain?"
        description={
          toDelete
            ? `Permanently delete ${toDelete.name}. This is only allowed for an empty domain.`
            : undefined
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
