'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/dashboard/AuthLayout';
import { useAuth } from '@/lib/auth-context';
import { BRAND } from '@/lib/brand';
import { getDashboardForUser } from '@/lib/role-routing';

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLayout title="Welcome back" subtitle="Loading…"><div /></AuthLayout>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Mail bridge Phase 5 — set when /auth/login returns HTTP 403, which
   * the Phase-4 backend uses for the PENDING_ACTIVATION hard-lock
   * ("set up your mailbox first"). Rendered as a separate amber panel
   * with a "Go to your mailbox" CTA instead of the generic red error
   * banner. Cleared on any subsequent submit. The submitted server
   * message is preserved as a sub-line so future 403 reasons (e.g.
   * "mailbox not ready") surface verbatim.
   */
  const [activationLock, setActivationLock] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams?.get('reason') === 'idle') {
      setNotice('You were signed out due to inactivity. Please sign in again.');
    }
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setActivationLock(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      const returnTo = safeReturnTo();
      router.replace(returnTo ?? getDashboardForUser(user));
    } catch (err: any) {
      // Mail bridge Phase 5 — Phase-4 backend returns 403 when a
      // PENDING_ACTIVATION user tries to sign in before activating
      // their company mailbox. Surface the activation panel (with a
      // CTA to /mail/login) instead of the generic red error. Normal
      // 401 "Invalid credentials" path is unchanged.
      const status = err?.response?.status;
      const msg = err?.response?.data?.error ?? 'Login failed';
      if (status === 403) {
        setActivationLock(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function safeReturnTo(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('returnTo');
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
    return decoded;
  }

  return (
    <AuthLayout title="Welcome back" subtitle={`Sign in to your ${BRAND.productName} account`}>
      {notice && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {notice}
        </div>
      )}
      {/* Mail bridge Phase 5 — activation panel for 403 hard-lock. */}
      {activationLock && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Set up your company mailbox first</p>
          <p className="mt-1">{activationLock}</p>
          <p className="mt-2 text-amber-800">
            Sign in to your mailbox, change the starting password to one of
            your choosing, then come back here and sign in with the new
            password.
          </p>
          <Link
            href="/mail/login"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Go to your mailbox →
          </Link>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-gradient-to-r from-accent to-accent-dark px-4 py-2.5 font-semibold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-6 flex justify-between text-sm">
        <Link
          href="/careers/register"
          className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
        >
          Create an account
        </Link>
        <Link
          href="/careers/forgot-password"
          className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </AuthLayout>
  );
}
