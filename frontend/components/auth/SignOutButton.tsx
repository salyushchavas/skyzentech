'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { broadcastSessionEvent } from '@/lib/session-broadcast';

/**
 * Shared sign-out control. Funnels through {@link useAuth().logout} (which
 * clears stored tokens + in-memory user) and then redirects to the login
 * page. Also broadcasts to sibling tabs so they end their sessions in
 * lock-step. Visual variant kept consistent across the role sidebars.
 */
export default function SignOutButton({
  variant = 'sidebar',
  onAfter,
  reason,
}: {
  variant?: 'sidebar' | 'menu';
  onAfter?: () => void;
  /** Optional reason appended to the login URL (e.g. 'idle'). */
  reason?: 'idle';
}) {
  const { logout } = useAuth();
  const router = useRouter();

  function handle() {
    try {
      broadcastSessionEvent({ type: 'logout', reason });
    } catch {
      // BroadcastChannel may be unsupported (SSR / old browsers) — ignore.
    }
    logout();
    onAfter?.();
    const dest = reason
      ? `/careers/login?reason=${encodeURIComponent(reason)}`
      : '/careers/login';
    router.replace(dest);
  }

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={handle}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
        Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
      Sign out
    </button>
  );
}
