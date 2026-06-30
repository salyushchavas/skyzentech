'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Globe, Inbox } from 'lucide-react';
import { useMailAuth } from '../../_providers/MailAuthProvider';

// Admin sub-nav. Domains is SUPER_ADMIN-only (the backend rejects ADMINs with
// 403 either way; hiding it is convenience).
export default function AdminNav() {
  const pathname = usePathname();
  const { account } = useMailAuth();
  const isSuper = account?.role === 'SUPER_ADMIN';

  const tabs = [
    { href: '/mail/admin', label: 'Mailboxes', icon: Inbox, show: true },
    { href: '/mail/admin/domains', label: 'Domains', icon: Globe, show: isSuper },
  ].filter((t) => t.show);

  return (
    <div className="flex items-center gap-1 border-b border-slate-200">
      <Link
        href="/mail"
        className="mr-2 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back to Mail</span>
      </Link>
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              'flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
              (active
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
