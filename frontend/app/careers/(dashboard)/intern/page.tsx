'use client';

import Link from 'next/link';
import { Mail, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import InternPageShell from '@/components/intern/InternPageShell';
import ExitSummaryCard from '@/components/exit/ExitSummaryCard';
import {
  useInternDashboard,
  type InternContact,
  type InternLifecycleStatus,
  type InternMode,
  type InternNextAction,
} from '@/components/intern/InternDashboardContext';
import { useState } from 'react';

const MODE_LABEL: Record<InternMode, string> = {
  APPLICANT: 'Applicant',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  NEW_HIRE: 'New Hire',
  ACTIVE_INTERN: 'Active Intern',
  INACTIVE: 'Inactive',
};

function humanizeStatus(s: InternLifecycleStatus): string {
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function InternHomePage() {
  const { data, loading, error } = useInternDashboard();

  if (loading && !data) {
    return (
      <InternPageShell title="Home">
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" aria-hidden />
          <div className="h-48 animate-pulse rounded-lg bg-slate-100" aria-hidden />
        </div>
      </InternPageShell>
    );
  }

  if (error || !data) {
    return (
      <InternPageShell title="Home">
        <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          We couldn&apos;t load your dashboard right now. {error ?? 'Please try again.'}
        </p>
      </InternPageShell>
    );
  }

  const firstName = data.user.firstName || data.user.email.split('@')[0];
  const modeLabel = MODE_LABEL[data.mode] ?? data.mode;
  const subtitle = `Mode: ${modeLabel} · ${humanizeStatus(data.lifecycleStatus)}`;

  const isInactive = data.mode === 'INACTIVE';

  return (
    <InternPageShell title={`Welcome, ${firstName}`} subtitle={subtitle}>
      {data.lifecycleStatus === 'REGISTERED' && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Verify your email to apply.
        </div>
      )}

      {isInactive && data.exitSummary ? (
        <div className="space-y-6">
          <NextActionCard action={data.nextAction} />
          <ExitSummaryCard summary={data.exitSummary} />
          <ContactsCard contacts={data.contacts} />
        </div>
      ) : (
        <>
          <NextActionCard action={data.nextAction} />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ContactsCard contacts={data.contacts} />
            <ActivityCard />
          </div>
        </>
      )}
    </InternPageShell>
  );
}

// ── Next action ───────────────────────────────────────────────────────────

function NextActionCard({ action }: { action: InternNextAction }) {
  const isResendVerification =
    action.ctaHref === '/api/v1/auth/resend-verification';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
            <Sparkles className="h-3 w-3" strokeWidth={2.5} />
            Next action
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            {action.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{action.description}</p>
        </div>
        {action.waiting && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            Waiting on {action.waitingFor ?? 'next step'}
          </span>
        )}
      </div>

      {action.ctaLabel && action.ctaHref && !action.waiting && (
        <div className="mt-4">
          {isResendVerification ? (
            <ResendVerificationButton label={action.ctaLabel} />
          ) : (
            <Link
              href={action.ctaHref}
              className="inline-flex items-center rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {action.ctaLabel}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function ResendVerificationButton({ label }: { label: string }) {
  const { data, refresh } = useInternDashboard();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    if (!data?.user.email) return;
    setSending(true);
    setErr(null);
    try {
      await api.post('/auth/resend-verification', { email: data.user.email });
      setDone(true);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send verification');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-emerald-700">
        Verification email sent — check your inbox.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={sending}
        className="inline-flex items-center rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
      >
        {sending ? 'Sending…' : label}
      </button>
      {err && (
        <p className="mt-2 text-xs text-rose-700">{err}</p>
      )}
    </div>
  );
}

// ── Contacts ─────────────────────────────────────────────────────────────

function ContactsCard({
  contacts,
}: {
  contacts: { erm: InternContact | null; trainer: InternContact | null; evaluator: InternContact | null; manager: InternContact | null };
}) {
  const entries: Array<{ role: string; contact: InternContact }> = [];
  if (contacts.erm) entries.push({ role: 'ERM', contact: contacts.erm });
  if (contacts.trainer) entries.push({ role: 'Trainer', contact: contacts.trainer });
  if (contacts.evaluator) entries.push({ role: 'Evaluator', contact: contacts.evaluator });
  if (contacts.manager) entries.push({ role: 'Manager', contact: contacts.manager });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Your contacts</h3>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Contacts will appear here once you&apos;re paired with the team.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {entries.map(({ role, contact }) => (
            <li key={role} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
                {initialsOf(contact.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900">
                  {contact.name}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {role}
                  </span>
                </div>
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline"
                >
                  <Mail className="h-3 w-3" strokeWidth={2} />
                  {contact.email}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Activity placeholder ─────────────────────────────────────────────────

function ActivityCard() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
      <p className="mt-3 text-sm text-slate-500">
        Activity will appear here as your journey progresses.
      </p>
    </section>
  );
}
