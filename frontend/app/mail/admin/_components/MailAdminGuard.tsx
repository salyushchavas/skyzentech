'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import MailGuard from '../../_providers/MailGuard';
import { useMailAuth } from '../../_providers/MailAuthProvider';

// Admin-only gate layered ON TOP of MailGuard. MailGuard guarantees a
// signed-in, non-pre-change account before RoleGate renders; RoleGate then
// bounces a plain USER to /mail. This is UI convenience — the backend
// (MAIL_ADMIN/MAIL_SUPER_ADMIN on /api/mail/admin/**, plus 403/404/409) is the
// real guard.
function RoleGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { account } = useMailAuth();
  const isAdmin = account?.role === 'ADMIN' || account?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (account && !isAdmin) {
      router.replace('/mail');
    }
  }, [account, isAdmin, router]);

  if (!account || !isAdmin) {
    return <div className="py-16 text-center text-sm text-slate-500">Redirecting…</div>;
  }
  return <>{children}</>;
}

export default function MailAdminGuard({ children }: { children: ReactNode }) {
  return (
    <MailGuard>
      <RoleGate>{children}</RoleGate>
    </MailGuard>
  );
}
