'use client';

import Link from 'next/link';
import { LogOut, Mail, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useMailAuth } from '../_providers/MailAuthProvider';

// Simple mail-branded header. Text + lucide icon only — no external brand asset,
// no Spire logo. Shows the signed-in account + sign-out when authenticated, plus
// an Admin link for ADMIN/SUPER_ADMIN accounts.
export default function MailHeader() {
  const { account, logout } = useMailAuth();
  const isAdmin = account?.role === 'ADMIN' || account?.role === 'SUPER_ADMIN';

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white">
            <Mail className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-slate-900">Skyzen Mail</span>
        </div>
        {account && (
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/mail/admin"
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-brand-700"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <span className="hidden text-sm text-slate-600 sm:inline">
              {account.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LogOut className="h-4 w-4" />}
              onClick={() => void logout()}
            >
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
