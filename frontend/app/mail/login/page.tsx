'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import FormField from '@/components/ui/FormField';
import { useMailAuth } from '../_providers/MailAuthProvider';

export default function MailLoginPage() {
  const router = useRouter();
  const { account, login } = useMailAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in → bounce in (respecting the must-change gate).
  useEffect(() => {
    if (account) {
      router.replace(account.mustChangePassword ? '/mail/change-password' : '/mail');
    }
  }, [account, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      router.replace(res.mustChangePassword ? '/mail/change-password' : '/mail');
    } catch (err) {
      const ax = err as {
        userMessage?: string;
        response?: { data?: { message?: string; error?: string } };
      };
      setError(
        ax.userMessage ??
          ax.response?.data?.message ??
          ax.response?.data?.error ??
          'Invalid email or password',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white">
          <Mail className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-semibold text-slate-900">Sign in to Skyzen Mail</h1>
        <p className="mt-1 text-sm text-slate-500">Use your mail address and password.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Email" htmlFor="mail-email">
            <Input
              id="mail-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@skyzentech.com"
            />
          </FormField>
          <FormField label="Password" htmlFor="mail-password">
            <Input
              id="mail-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </FormField>
          <Button type="submit" fullWidth loading={loading}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
