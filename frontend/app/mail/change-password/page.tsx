'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import FormField from '@/components/ui/FormField';
import { getMailToken } from '@/lib/mail-auth-storage';
import { useMailAuth } from '../_providers/MailAuthProvider';

export default function MailChangePasswordPage() {
  const router = useRouter();
  const { account, isLoading, changePassword } = useMailAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authenticated screen — reachable with a pre-change token. No token at all
  // (and not still loading) → bounce to login.
  useEffect(() => {
    if (!isLoading && !account && !getMailToken()) {
      router.replace('/mail/login');
    }
  }, [isLoading, account, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the current one.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      router.replace('/mail');
    } catch (err) {
      const ax = err as {
        userMessage?: string;
        response?: { data?: { message?: string; error?: string } };
      };
      setError(
        ax.userMessage ??
          ax.response?.data?.message ??
          ax.response?.data?.error ??
          'Could not change password',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" strokeWidth={2} />
        <div>
          <h1 className="text-base font-semibold text-amber-900">Set a new password</h1>
          <p className="mt-1 text-xs text-amber-900/90">
            Your mail account requires a new password before you can continue.
          </p>
        </div>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            {account ? `Signed in as ${account.email}` : 'Change your password'}
          </h2>
        </div>
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Current password" htmlFor="mail-current">
            <Input
              id="mail-current"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </FormField>
          <FormField label="New password (min 8 chars)" htmlFor="mail-new">
            <Input
              id="mail-new"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </FormField>
          <FormField label="Confirm new password" htmlFor="mail-confirm">
            <Input
              id="mail-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </FormField>
          <Button
            type="submit"
            fullWidth
            loading={submitting}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            Set new password
          </Button>
        </form>
      </section>
    </div>
  );
}
