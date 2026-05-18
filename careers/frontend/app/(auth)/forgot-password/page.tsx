'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      // Backend always returns 200 anyway. We deliberately surface no error
      // to avoid leaking whether the email is registered.
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Reset your password</h1>
      {submitted ? (
        <div>
          <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            If that email is registered, a reset link has been sent.
          </div>
          <p className="text-xs text-slate-500">
            Dev note: token is logged to backend console for now.
          </p>
          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-slate-600">
            Enter your email and we&apos;ll send instructions to reset your password.
          </p>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <div className="text-center text-sm">
            <Link href="/login" className="text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
