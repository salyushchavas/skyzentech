'use client';

import MailGuard from './_providers/MailGuard';
import { useMailAuth } from './_providers/MailAuthProvider';

function MailHomeInner() {
  const { account } = useMailAuth();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Welcome to Skyzen Mail</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as{' '}
          <span className="font-medium text-slate-900">{account?.email}</span>
          {account?.role ? ` (${account.role})` : ''}.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Your mailbox is coming soon — this is the authenticated home stub for the
          S2 auth shell. The full client lands in a later phase.
        </p>
      </div>
    </div>
  );
}

export default function MailHomePage() {
  return (
    <MailGuard>
      <MailHomeInner />
    </MailGuard>
  );
}
