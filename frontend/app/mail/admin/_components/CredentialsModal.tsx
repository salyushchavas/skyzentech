'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { MailCredentialResponse } from '@/lib/mail-client';

// SHOW-ONCE credentials modal. The one-time password lives only here, in
// component state passed from the create/reset call result — it is never
// refetched or persisted. Closing discards it.
export default function CredentialsModal({
  credential,
  title,
  onClose,
}: {
  credential: MailCredentialResponse | null;
  title: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!credential) return null;

  async function copy() {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(credential.oneTimePassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked; the password is still visible to copy manually
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
            <KeyRound className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Mailbox
            </div>
            <div className="mt-0.5 text-sm font-medium text-slate-900">
              {credential.email}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              One-time password
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900">
                {credential.oneTimePassword}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void copy()}
                leftIcon={
                  copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />
                }
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <span>
              You won&apos;t see this password again. Send it to the user over a secure
              channel.
              {credential.mustChangePassword
                ? ' They must change it on first sign-in.'
                : ''}
            </span>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
