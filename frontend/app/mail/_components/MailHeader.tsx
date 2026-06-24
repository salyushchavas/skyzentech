'use client';

import Link from 'next/link';
import { LogOut, Settings, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useMailAuth } from '../_providers/MailAuthProvider';
import MailAvatar from './MailAvatar';

// Mail header: the real Skyzen logo (reusing the careers asset
// /images/skyzen-logo.png) + a "Mail" wordmark, with a calm right-side nav.
// Data flow unchanged — still reads account + logout from useMailAuth.
export default function MailHeader() {
  const { account, logout } = useMailAuth();
  const isAdmin = account?.role === 'ADMIN' || account?.role === 'SUPER_ADMIN';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/mail" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/skyzen-logo.png" alt="Skyzen" className="h-9 w-auto" />
          <span className="text-lg font-semibold tracking-tight text-slate-800">Mail</span>
        </Link>

        {account && (
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/mail/settings"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-700"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            {isAdmin && (
              <Link
                href="/mail/admin"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-700"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
            <span className="hidden items-center gap-2 md:flex">
              <MailAvatar name={account.displayName || account.email} size="sm" />
              <span className="max-w-[12rem] truncate text-sm text-slate-600">{account.email}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LogOut className="h-4 w-4" />}
              onClick={() => void logout()}
            >
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
