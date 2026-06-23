'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import FormField from '@/components/ui/FormField';
import {
  createMailbox,
  mailErrorMessage,
  type MailCredentialResponse,
  type MailDomainResponse,
} from '@/lib/mail-client';

// Create-mailbox form modal. Password is optional — leave "auto-generate" on
// and the server returns a strong one-time password. Domain is a picker for
// SUPER_ADMIN and fixed (own domain) for ADMIN.
export default function CreateMailboxModal({
  open,
  onClose,
  isSuper,
  domains,
  fixedDomainId,
  fixedDomainName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isSuper: boolean;
  domains: MailDomainResponse[];
  fixedDomainId: string | null;
  fixedDomainName: string;
  onCreated: (cred: MailCredentialResponse) => void;
}) {
  const [localPart, setLocalPart] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [password, setPassword] = useState('');
  const [requireChange, setRequireChange] = useState(true);
  const [domainId, setDomainId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the modal (re)opens; default the domain for supers.
  useEffect(() => {
    if (!open) return;
    setLocalPart('');
    setDisplayName('');
    setAutoGenerate(true);
    setPassword('');
    setRequireChange(true);
    setError(null);
    setSubmitting(false);
    setDomainId(isSuper ? domains[0]?.id ?? '' : fixedDomainId ?? '');
  }, [open, isSuper, domains, fixedDomainId]);

  if (!open) return null;

  const effectiveDomainId = isSuper ? domainId : fixedDomainId ?? '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!localPart.trim()) {
      setError('Local part is required.');
      return;
    }
    if (!effectiveDomainId) {
      setError('No domain available for this mailbox.');
      return;
    }
    if (!autoGenerate && password.length < 8) {
      setError('Password must be at least 8 characters (or use auto-generate).');
      return;
    }
    setSubmitting(true);
    try {
      const cred = await createMailbox({
        domainId: effectiveDomainId,
        localPart: localPart.trim(),
        displayName: displayName.trim() || undefined,
        password: autoGenerate ? undefined : password,
        requireChangeOnFirstLogin: requireChange,
      });
      onCreated(cred);
    } catch (err) {
      setError(mailErrorMessage(err, 'Could not create mailbox'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
            <UserPlus className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-semibold text-slate-900">Create mailbox</h2>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Local part" htmlFor="mb-local" helper="The part before the @.">
            <Input
              id="mb-local"
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value)}
              placeholder="firstname.lastname"
              required
            />
          </FormField>

          <FormField label="Domain" htmlFor="mb-domain">
            {isSuper ? (
              <select
                id="mb-domain"
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {domains.length === 0 && <option value="">No domains</option>}
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            ) : (
              <Input id="mb-domain" value={fixedDomainName} disabled readOnly />
            )}
          </FormField>

          <FormField label="Display name" htmlFor="mb-display">
            <Input
              id="mb-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="First Last"
            />
          </FormField>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(e) => setAutoGenerate(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
            />
            Auto-generate a strong password
          </label>

          {!autoGenerate && (
            <FormField label="Password" htmlFor="mb-password" helper="At least 8 characters.">
              <Input
                id="mb-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </FormField>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={requireChange}
              onChange={(e) => setRequireChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
            />
            Require password change on first sign-in
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create mailbox
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
