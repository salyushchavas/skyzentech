'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMailAuth } from './MailAuthProvider';

// Mail-scoped route guard (NOT Skyzen's ProtectedRoute). Used on fully-protected
// mail pages: no session → /mail/login; pre-change → /mail/change-password;
// otherwise render. The change-password page does its own lighter check so it
// stays reachable with a pre-change token.
export default function MailGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { account, isLoading } = useMailAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!account) {
      router.replace('/mail/login');
      return;
    }
    if (account.mustChangePassword) {
      router.replace('/mail/change-password');
    }
  }, [account, isLoading, router]);

  if (isLoading || !account || account.mustChangePassword) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">Loading…</div>
    );
  }
  return <>{children}</>;
}
