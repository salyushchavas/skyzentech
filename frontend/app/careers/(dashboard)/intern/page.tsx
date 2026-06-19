'use client';

import Link from 'next/link';
import { Mail, PartyPopper, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import InternPageShell from '@/components/intern/InternPageShell';
import InternProfileCompletionCard from '@/components/intern/InternProfileCompletionCard';
import ExitSummaryCard from '@/components/exit/ExitSummaryCard';
import {
  useInternDashboard,
  type InternContact,
  type InternLifecycleStatus,
  type InternMode,
  type InternNextAction,
  type InternSelectionAck,
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
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
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
          {data.applyReadiness && !data.applyReadiness.complete && (
            <InternProfileCompletionCard readiness={data.applyReadiness} />
          )}
          {data.selectionAck && (
            <div className="mb-6">
              <SelectionAckCard ack={data.selectionAck} />
            </div>
          )}
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

// ── Selection acknowledgment ─────────────────────────────────────────────

function SelectionAckCard({ ack }: { ack: InternSelectionAck }) {
  const { refresh } = useInternDashboard();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const jobLabel = ack.jobTitle?.trim() || 'the role';

  async function onClick() {
    setBusy(true);
    setErr(null);
    try {
      // Full /api/v1 path — the axios baseURL is the bare backend host
      // (no /api/v1 rewrite), so a bare /applications/... 404s.
      await api.post(`/api/v1/applications/${ack.applicationId}/acknowledge-selection`);
      // Optimistic refresh — the dashboard endpoint will null out
      // selectionAck and shift NextAction to "Offer on its way".
      await refresh();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(
        ax.response?.data?.error
          ?? (e instanceof Error ? e.message : 'Could not record acknowledgment'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-green-200 bg-green-50 p-6 shadow-sm">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-800">
        <PartyPopper className="h-3 w-3" strokeWidth={2.5} />
        Congratulations
      </div>
      <h2 className="mt-2 text-xl font-semibold text-green-900">
        You&apos;ve been selected for {jobLabel}
      </h2>
      <p className="mt-1 text-sm text-green-900/90">
        When you&apos;re ready, click the button below. We&apos;ll prepare and
        send your offer letter right after — you&apos;ll receive an IDMS
        email to review and sign.
      </p>
      {ack.applicantVisibleNotes && (
        <div className="mt-3 rounded-md border border-green-200 bg-white p-3 text-sm text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">
            From the interview team
          </p>
          <p className="mt-1 whitespace-pre-wrap">{ack.applicantVisibleNotes}</p>
        </div>
      )}
      <div className="mt-4">
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          className="inline-flex items-center rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Receive my offer letter'}
        </button>
        {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
      </div>
    </section>
  );
}

// ── Next action ───────────────────────────────────────────────────────────

function NextActionCard({ action }: { action: InternNextAction }) {
  const isResendVerification =
    action.ctaHref === '/api/v1/auth/resend-verification';
  // Backend buildNextAction emits this href when SelectionAckPolicy
  // .needsAck is true for the candidate — the NEXT ACTION owns the
  // acknowledge CTA so it can't be missed if the SelectionAckCard
  // above isn't visible. Pattern mirrors the resend-verification
  // custom-button path. Backend emits the full /api/v1/applications/
  // prefix because the axios client has no rewrite.
  const ackPrefix = '/api/v1/applications/';
  const ackSuffix = '/acknowledge-selection';
  const isAcknowledgeSelection =
    typeof action.ctaHref === 'string'
    && action.ctaHref.startsWith(ackPrefix)
    && action.ctaHref.endsWith(ackSuffix);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
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
          ) : isAcknowledgeSelection ? (
            <AcknowledgeSelectionButton label={action.ctaLabel} href={action.ctaHref} />
          ) : (
            <Link
              href={action.ctaHref}
              className="inline-flex items-center rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              {action.ctaLabel}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function AcknowledgeSelectionButton({ label, href }: { label: string; href: string }) {
  const { refresh } = useInternDashboard();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setErr(null);
    try {
      await api.post(href);
      await refresh();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(
        ax.response?.data?.error
          ?? (e instanceof Error ? e.message : 'Could not record acknowledgment'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {busy ? 'Sending…' : label}
      </button>
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
    </div>
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
      <p className="text-sm text-green-700">
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
        className="inline-flex items-center rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
      >
        {sending ? 'Sending…' : label}
      </button>
      {err && (
        <p className="mt-2 text-xs text-red-700">{err}</p>
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
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
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
                  className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
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
