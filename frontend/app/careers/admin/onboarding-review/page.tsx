'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageHeader from '@/components/ui/PageHeader';
import api from '@/lib/api';

interface QueueItem {
  id: string;
  category: string;
  status: string;
  packetId: string;
  submittedAt?: string | null;
  version: number;
}

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  W4: 'W-4', I9: 'I-9 §1', ACH: 'ACH', EMERGENCY_CONTACT: 'Emergency',
  HANDBOOK_ACK: 'Handbook', I983: 'I-983',
};

/**
 * Minimal ERM-side stub so the onboarding review loop can be exercised
 * before the full ERM dashboard ships. Lists every SUBMITTED item across
 * all interns and offers ACCEPT / REJECT / RESEND actions per item.
 */
export default function OnboardingReviewPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'SUPER_ADMIN']}>
      <DashboardLayout>
        <PageHeader
          title="Onboarding Review"
          subtitle="Submitted onboarding items awaiting your review."
        />
        <ReviewQueue />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function ReviewQueue() {
  const [page, setPage] = useState<Page<QueueItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Page<QueueItem>>('/api/v1/onboarding/review-queue?page=0&size=25');
      setPage(res.data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, decision: 'ACCEPT' | 'REJECT' | 'RESEND') {
    let comments: string | null = null;
    if (decision !== 'ACCEPT') {
      comments = prompt('ERM comments (min 10 chars):');
      if (!comments || comments.trim().length < 10) {
        alert('Comments must be at least 10 characters.');
        return;
      }
    }
    setBusy(id);
    try {
      await api.post(`/api/v1/onboarding/items/${id}/review`, {
        decision,
        ermComments: comments,
      });
      await load();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string; message?: string } } };
      alert(ax.response?.data?.error ?? ax.response?.data?.message ?? 'Review failed');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg bg-slate-50" aria-hidden />;
  }
  if (err) {
    return <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{err}</p>;
  }
  if (!page || page.content.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Queue is empty. Submitted onboarding items will appear here.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {page.content.map((it) => (
        <li key={it.id} className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
            {CATEGORY_LABEL[it.category] ?? it.category}
          </span>
          <span className="text-xs text-slate-500">v{it.version}</span>
          <span className="text-[11px] text-slate-400">
            Submitted {it.submittedAt ? new Date(it.submittedAt).toLocaleString() : '?'}
          </span>
          <span className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => act(it.id, 'ACCEPT')}
              disabled={busy === it.id}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => act(it.id, 'RESEND')}
              disabled={busy === it.id}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              Resend
            </button>
            <button
              type="button"
              onClick={() => act(it.id, 'REJECT')}
              disabled={busy === it.id}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              Reject
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
