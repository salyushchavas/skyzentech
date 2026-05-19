'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

function initialOf(user: { fullName?: string; email: string }): string {
  if (user.fullName) {
    const first = user.fullName.trim().split(/\s+/)[0];
    if (first) return first[0]?.toUpperCase() ?? 'U';
  }
  return user.email[0]?.toUpperCase() ?? 'U';
}

function roleSlug(role?: string): string {
  return (role ?? 'candidate').toLowerCase();
}

export default function UserMenuDropdown() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const initial = initialOf(user);
  const profileHref = `/careers/${roleSlug(user.roles?.[0])}/profile`;

  function handleSignOut() {
    setOpen(false);
    logout();
    router.push('/careers/login');
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        className={
          'flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white transition ' +
          (open ? 'ring-2 ring-accent/40' : 'hover:ring-2 hover:ring-accent/20')
        }
      >
        {initial}
      </button>

      <div
        role="menu"
        className={
          'absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg transition duration-150 ' +
          (open
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0')
        }
      >
        <div className="border-b border-gray-100 px-3 py-2">
          <div className="text-sm font-medium text-gray-900">
            {user.fullName ?? user.email}
          </div>
          <div className="truncate text-xs text-gray-500">{user.email}</div>
        </div>

        <Link
          href={profileHref}
          role="menuitem"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <UserIcon className="h-[18px] w-[18px]" strokeWidth={2} />
          Profile
        </Link>
        <Link
          href="/"
          role="menuitem"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <Home className="h-[18px] w-[18px]" strokeWidth={2} />
          Back to main site
        </Link>

        <div className="my-1 border-t border-gray-100" />

        <button
          type="button"
          role="menuitem"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          Sign out
        </button>
      </div>
    </div>
  );
}
