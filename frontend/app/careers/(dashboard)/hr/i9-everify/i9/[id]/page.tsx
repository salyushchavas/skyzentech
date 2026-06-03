'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ConfirmDialog from '@/components/ConfirmDialog';
import I9StatusBadge from '@/components/i9/I9StatusBadge';
import Section1ReadOnlyView from '@/components/i9/Section1ReadOnlyView';
import Section2ReadOnlyView from '@/components/i9/Section2ReadOnlyView';
import Section2Form from '@/components/i9/Section2Form';
import AuditHistoryList from '@/components/i9/AuditHistoryList';
import ReopenI9Dialog from '@/components/i9/ReopenI9Dialog';
import EVerifyStatusBadge from '@/components/everify/EVerifyStatusBadge';
import { formatDateOnly, formatFull } from '@/lib/format-date';
import type {
  EVerifyCaseResponse,
  I9FormResponse,
  I9HistoryEntryResponse,
} from '@/types';

type Tab = 'section1' | 'section2' | 'history';
const VALID_TABS: Tab[] = ['section1', 'section2', 'history'];

export default function HrI9DetailPage() {
  return (
    <ProtectedRoute requiredRoles={['OPERATIONS', 'HR']}>
      <DashboardLayout title="I-9 Form">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams();
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : null;

  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('OPERATIONS') ?? false;
  const canCreateEVerify =
    user?.roles?.some((r) => r === 'HR' || r === 'OPERATIONS') ?? false;

  const [form, setForm] = useState<I9FormResponse | null>(null);
  const [history, setHistory] = useState<I9HistoryEntryResponse[] | null>(null);
  const [everifyCase, setEverifyCase] = useState<EVerifyCaseResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('section1');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [createCaseOpen, setCreateCaseOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [fRes, hRes] = await Promise.all([
        api.get<I9FormResponse>(`/api/v1/i9/${id}`),
        api.get<I9HistoryEntryResponse[]>(`/api/v1/i9/${id}/history`),
      ]);
      setForm(fRes.data);
      setHistory(hRes.data ?? []);
      // Look up linked E-Verify case (404 = no case yet → render the Create UI).
      try {
        const eRes = await api.get<EVerifyCaseResponse>(
          `/api/v1/everify/i9/${fRes.data.id}`
        );
        setEverifyCase(eRes.data);
      } catch {
        setEverifyCase(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load this I-9.");
      setForm(null);
      setHistory(null);
    }
  }, [id]);

  async function handleCreateEVerify() {
    if (!form) return;
    try {
      const res = await api.post<EVerifyCaseResponse>('/api/v1/everify', {
        i9FormId: form.id,
      });
      toast.success('E-Verify case created');
      setCreateCaseOpen(false);
      router.push(`/careers/hr/i9-everify/everify/${res.data.id}`);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ?? "Couldn't create E-Verify case."
      );
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  // Pick the initial tab from URL hash, falling back to status-based default.
  useEffect(() => {
    if (!form || typeof window === 'undefined') return;
    const fromHash = window.location.hash.replace('#', '');
    if (VALID_TABS.includes(fromHash as Tab)) {
      setTab(fromHash as Tab);
      return;
    }
    if (form.status === 'SECTION_2_PENDING' || form.status === 'SECTION_1_COMPLETE' || form.status === 'REOPENED') {
      setTab('section2');
    } else {
      setTab('section1');
    }
  }, [form]);

  function switchTab(next: Tab) {
    setTab(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#' + next);
    }
  }

  function handleFormSaved(updated: I9FormResponse) {
    setForm(updated);
    // Refresh audit history so the new entry shows up immediately.
    if (id) {
      void api
        .get<I9HistoryEntryResponse[]>(`/api/v1/i9/${id}/history`)
        .then((res) => setHistory(res.data ?? []))
        .catch(() => {});
    }
    // After a successful Section 2 submit, jump to History so HR sees the
    // signed-and-logged entry confirming the action.
    if (updated.status === 'COMPLETED' && tab === 'section2') {
      switchTab('history');
    }
  }

  if (form === null && !error) return <DetailSkeleton />;

  if (error && !form) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <Link
          href="/careers/hr/i9-everify"
          className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
        >
          Back to I-9 list
        </Link>
      </div>
    );
  }

  if (!form) return null;

  return (
    <>
      <Link
        href="/careers/hr/i9-everify"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to I-9 list
      </Link>

      {/* Header card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {form.candidateName ?? '(unnamed candidate)'}
            </h2>
            {form.candidateEmail && (
              <div className="text-sm text-gray-500">{form.candidateEmail}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {form.candidateId && (
              <Link
                href={`/careers/hr/evaluations/${form.candidateId}`}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                View evaluations
              </Link>
            )}
            <I9StatusBadge status={form.status} size="md" />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="First day of work"
            value={
              form.firstDayOfEmployment
                ? formatDateOnly(form.firstDayOfEmployment)
                : 'Not yet set'
            }
          />
          <Stat
            label="Section 2 deadline"
            value={
              form.section2DueDate ? formatDateOnly(form.section2DueDate) : '—'
            }
          />
          <Stat
            label="Days remaining"
            value={<DaysRemaining form={form} />}
          />
        </dl>

        {form.overdue && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              This I-9 is overdue. Section 2 must be completed immediately.
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-6 border-b border-gray-200">
        <TabButton
          active={tab === 'section1'}
          onClick={() => switchTab('section1')}
        >
          Section 1
        </TabButton>
        <TabButton
          active={tab === 'section2'}
          onClick={() => switchTab('section2')}
        >
          Section 2
        </TabButton>
        <TabButton
          active={tab === 'history'}
          onClick={() => switchTab('history')}
        >
          History
        </TabButton>
      </div>

      {/* Tab content */}
      {tab === 'section1' && <Section1Tab form={form} />}

      {tab === 'section2' && (
        <Section2Tab
          form={form}
          onSaved={handleFormSaved}
          isAdmin={isAdmin}
          onReopenClick={() => setReopenOpen(true)}
          everifyCase={everifyCase}
          canCreateEVerify={canCreateEVerify}
          onCreateEVerifyClick={() => setCreateCaseOpen(true)}
        />
      )}

      {tab === 'history' && (
        <div className="max-w-2xl">
          {history === null ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <AuditHistoryList entries={history} />
          )}
        </div>
      )}

      <ReopenI9Dialog
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        onReopened={(updated) => {
          setForm(updated);
          // Refresh history to surface the REOPEN entry, then jump there.
          if (id) {
            void api
              .get<I9HistoryEntryResponse[]>(`/api/v1/i9/${id}/history`)
              .then((res) => setHistory(res.data ?? []))
              .catch(() => {});
          }
          switchTab('section2');
        }}
        formId={form.id}
      />

      <ConfirmDialog
        open={createCaseOpen}
        onClose={() => setCreateCaseOpen(false)}
        onConfirm={handleCreateEVerify}
        title="Create E-Verify case?"
        description={`This creates an E-Verify case for ${
          form.candidateName ?? 'this candidate'
        }. After submitting the case in real E-Verify, return here to record the case number and outcome.`}
        confirmLabel="Create Case"
        variant="primary"
      />
    </>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function DaysRemaining({ form }: { form: I9FormResponse }) {
  if (form.status === 'COMPLETED' || form.section2DueDate == null) {
    return <span className="text-gray-500">—</span>;
  }
  const d = form.daysUntilDue;
  if (d == null) return <span className="text-gray-500">—</span>;
  if (form.overdue) {
    return (
      <span className="font-medium text-red-700">
        Overdue by {Math.abs(d)}d
      </span>
    );
  }
  if (d <= 2) {
    return <span className="font-medium text-amber-700">{d}d remaining</span>;
  }
  return <span className="text-gray-700">{d}d</span>;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        '-mb-px pb-3 text-sm font-medium transition-colors ' +
        (active
          ? 'border-b-2 border-accent text-accent'
          : 'text-gray-500 hover:text-gray-700')
      }
    >
      {children}
    </button>
  );
}

function Section1Tab({ form }: { form: I9FormResponse }) {
  if (!form.section1SignedAt) {
    return (
      <p className="text-sm text-gray-500">
        Candidate hasn&apos;t completed Section 1 yet.
      </p>
    );
  }
  return <Section1ReadOnlyView form={form} />;
}

function Section2Tab({
  form,
  onSaved,
  isAdmin,
  onReopenClick,
  everifyCase,
  canCreateEVerify,
  onCreateEVerifyClick,
}: {
  form: I9FormResponse;
  onSaved: (updated: I9FormResponse) => void;
  isAdmin: boolean;
  onReopenClick: () => void;
  everifyCase: EVerifyCaseResponse | null;
  canCreateEVerify: boolean;
  onCreateEVerifyClick: () => void;
}) {
  if (form.status === 'NOT_STARTED') {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="text-sm text-gray-700">
          Section 1 must be completed by the candidate before you can begin
          Section 2.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          A "Send reminder" email will land here when notifications ship.
        </p>
      </div>
    );
  }

  // SECTION_2_PENDING is the canonical post-Section-1 state (Phase 3 step 5);
  // SECTION_1_COMPLETE is the legacy alias kept for pre-3.5 rows. REOPENED also
  // re-enters the Section 2 form so HR can re-sign after an admin reopen.
  if (
    form.status === 'SECTION_2_PENDING'
    || form.status === 'SECTION_1_COMPLETE'
    || form.status === 'REOPENED'
  ) {
    return <Section2Form form={form} onSaved={onSaved} />;
  }

  // COMPLETED
  return (
    <div className="max-w-3xl">
      <Section2ReadOnlyView form={form} />
      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500">
          {form.section2SignedByName && form.section2SignedAt
            ? `Signed by ${form.section2SignedByName} on ${formatFull(form.section2SignedAt)}`
            : null}
        </p>
        {isAdmin && (
          <button
            type="button"
            onClick={onReopenClick}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
            Reopen for correction
          </button>
        )}
      </div>

      {/* E-Verify cross-link panel — surfaces next compliance step. */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" strokeWidth={2} />
          <h3 className="text-sm font-semibold text-gray-900">
            E-Verify Case
          </h3>
        </div>
        {everifyCase ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              <EVerifyStatusBadge status={everifyCase.status} />
              {everifyCase.caseNumber && (
                <span className="font-mono text-xs text-gray-500">
                  {everifyCase.caseNumber}
                </span>
              )}
            </div>
            <Link
              href={`/careers/hr/i9-everify/everify/${everifyCase.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-dark"
            >
              View case
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
            </Link>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              No E-Verify case has been opened for this I-9 yet.
            </p>
            {canCreateEVerify && (
              <button
                type="button"
                onClick={onCreateEVerifyClick}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark"
              >
                Create E-Verify Case
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <>
      <div className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="h-12 animate-pulse rounded bg-gray-100" />
          <div className="h-12 animate-pulse rounded bg-gray-100" />
          <div className="h-12 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      <div className="mb-6 flex gap-6 border-b border-gray-200">
        <div className="h-6 w-20 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-20 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-20 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="space-y-3">
        <div className="h-40 animate-pulse rounded bg-gray-100" />
        <div className="h-32 animate-pulse rounded bg-gray-100" />
      </div>
    </>
  );
}
