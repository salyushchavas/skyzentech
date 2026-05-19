'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField from '@/components/ui/FormField';
import I983StatusBadge from '@/components/i983/I983StatusBadge';
import DsoStatusBadge from '@/components/i983/DsoStatusBadge';
import I983PlanForm from '@/components/i983/I983PlanForm';
import I983ReadOnlyView from '@/components/i983/I983ReadOnlyView';
import AuditHistoryList from '@/components/i9/AuditHistoryList';
import { formatDateOnly, formatFull } from '@/lib/format-date';
import type {
  DsoResponseRequest,
  I983HistoryEntryResponse,
  I983PlanResponse,
} from '@/types';

type Tab = 'details' | 'signatures' | 'dso' | 'history';
const VALID_TABS: Tab[] = ['details', 'signatures', 'dso', 'history'];

export default function ErmI983DetailPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM', 'HR_COMPLIANCE', 'ADMIN']}>
      <DashboardLayout title="I-983 Training Plan">
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

  const [plan, setPlan] = useState<I983PlanResponse | null>(null);
  const [history, setHistory] = useState<I983HistoryEntryResponse[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('details');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [pRes, hRes] = await Promise.all([
        api.get<I983PlanResponse>(`/api/v1/i983/${id}`),
        api.get<I983HistoryEntryResponse[]>(`/api/v1/i983/${id}/history`),
      ]);
      setPlan(pRes.data);
      setHistory(hRes.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load this plan.");
      setPlan(null);
      setHistory(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Initial tab — URL hash wins, otherwise status-based default.
  useEffect(() => {
    if (!plan || typeof window === 'undefined') return;
    const fromHash = window.location.hash.replace('#', '');
    if (VALID_TABS.includes(fromHash as Tab)) {
      setTab(fromHash as Tab);
      return;
    }
    if (plan.status === 'COMPLETE') setTab('dso');
    else setTab('details');
  }, [plan]);

  function switchTab(next: Tab) {
    setTab(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#' + next);
    }
  }

  function refreshHistory() {
    if (!id) return;
    void api
      .get<I983HistoryEntryResponse[]>(`/api/v1/i983/${id}/history`)
      .then((res) => setHistory(res.data ?? []))
      .catch(() => {});
  }

  function handlePlanSaved(updated: I983PlanResponse) {
    setPlan(updated);
    refreshHistory();
  }

  if (plan === null && !error) return <DetailSkeleton />;

  if (error && !plan) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <Link
          href="/careers/erm/training-plans"
          className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
        >
          Back to plans
        </Link>
      </div>
    );
  }

  if (!plan) return null;

  const editable =
    plan.status === 'DRAFT' || plan.status === 'AMENDMENT_REQUESTED';

  return (
    <>
      <Link
        href="/careers/erm/training-plans"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to plans
      </Link>

      {/* Header card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {plan.candidateName ?? '(unnamed candidate)'}
            </h2>
            {plan.candidateEmail && (
              <div className="text-sm text-gray-500">{plan.candidateEmail}</div>
            )}
            <div className="mt-1 text-sm text-gray-700">
              {plan.jobTitle ?? '(no job title yet)'}
              {plan.entityName && (
                <>
                  {' '}
                  <span className="text-gray-400">·</span>{' '}
                  <span className="text-gray-600">{plan.entityName}</span>
                </>
              )}
            </div>
          </div>
          <I983StatusBadge status={plan.status} size="md" />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="Employer Signed"
            value={
              plan.employerSignedAt ? (
                <span className="text-green-700">
                  ✓ {plan.employerSignedName ?? plan.employerSignedByName ?? '—'}{' '}
                  <span className="text-xs text-gray-500">
                    on {formatDateOnly(plan.employerSignedAt)}
                  </span>
                </span>
              ) : (
                <span className="text-gray-500">⏳ Not yet signed</span>
              )
            }
          />
          <Stat
            label="Student Signed"
            value={
              plan.studentSignedAt ? (
                <span className="text-green-700">
                  ✓ {plan.studentSignedName ?? '—'}{' '}
                  <span className="text-xs text-gray-500">
                    on {formatDateOnly(plan.studentSignedAt)}
                  </span>
                </span>
              ) : (
                <span className="text-gray-500">⏳ Not yet signed</span>
              )
            }
          />
          <Stat
            label="DSO Status"
            value={
              <>
                <DsoStatusBadge status={plan.dsoApprovalStatus} />
                {plan.dsoSubmittedAt && (
                  <div className="mt-1 text-xs text-gray-500">
                    submitted {formatDateOnly(plan.dsoSubmittedAt)}
                  </div>
                )}
              </>
            }
          />
        </dl>

        {plan.status === 'AMENDMENT_REQUESTED' && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              DSO requested changes — see Plan Details tab + History for
              context. Signatures have been cleared; both parties must re-sign
              after corrections.
            </span>
          </div>
        )}
        {plan.status === 'DSO_REJECTED' && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              DSO rejected this plan. A new plan must be created from scratch.
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-6 border-b border-gray-200">
        <TabBtn active={tab === 'details'} onClick={() => switchTab('details')}>
          Plan Details
        </TabBtn>
        <TabBtn
          active={tab === 'signatures'}
          onClick={() => switchTab('signatures')}
        >
          Signatures
        </TabBtn>
        <TabBtn active={tab === 'dso'} onClick={() => switchTab('dso')}>
          DSO
        </TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => switchTab('history')}>
          History
        </TabBtn>
      </div>

      {tab === 'details' &&
        (editable ? (
          <I983PlanForm plan={plan} onSaved={handlePlanSaved} />
        ) : (
          <I983ReadOnlyView plan={plan} />
        ))}

      {tab === 'signatures' && (
        <SignaturesTab
          plan={plan}
          editable={editable}
          onSigned={handlePlanSaved}
          onGoToDetails={() => switchTab('details')}
        />
      )}

      {tab === 'dso' && (
        <DsoTab
          plan={plan}
          onUpdated={(updated) => {
            handlePlanSaved(updated);
            switchTab('history');
          }}
          onGoToSignatures={() => switchTab('signatures')}
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
    </>
  );
}

// ── Signatures tab ──────────────────────────────────────────────────────────

function SignaturesTab({
  plan,
  editable,
  onSigned,
  onGoToDetails,
}: {
  plan: I983PlanResponse;
  editable: boolean;
  onSigned: (updated: I983PlanResponse) => void;
  onGoToDetails: () => void;
}) {
  const [attested, setAttested] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleSignEmployer() {
    try {
      const res = await api.post<I983PlanResponse>(
        `/api/v1/i983/${plan.id}/sign-employer`
      );
      toast.success('Signed as employer ✓');
      onSigned(res.data);
      setConfirmOpen(false);
      setAttested(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Couldn't sign.";
      toast.error('Cannot sign: ' + msg);
      // If validation failed, drop to details to fix.
      if (err?.response?.status === 400) {
        setConfirmOpen(false);
        onGoToDetails();
      }
    }
  }

  const employerSigned = Boolean(plan.employerSignedAt);
  const studentSigned = Boolean(plan.studentSignedAt);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Employer signature */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">
            Employer Signature
          </h3>
          <div className="my-3 h-px bg-gray-100" />
          {employerSigned ? (
            <div className="text-sm text-gray-700">
              ✓ Signed by{' '}
              <span className="font-medium">
                {plan.employerSignedName ?? plan.employerSignedByName ?? '—'}
              </span>
              <div className="text-xs text-gray-500">
                on {formatFull(plan.employerSignedAt)}
              </div>
            </div>
          ) : editable ? (
            <>
              <p className="text-sm text-gray-600">
                Sign on behalf of{' '}
                <span className="font-medium text-gray-900">
                  {plan.entityName ?? 'the employer'}
                </span>{' '}
                as the employer representative.
              </p>
              <div className="mt-4 rounded-md bg-gray-50 p-4 text-sm text-gray-700">
                <p>
                  <strong>Employer attestation.</strong> I attest that the
                  information in this Training Plan is accurate and that{' '}
                  {plan.entityName ?? 'the employer'} commits to providing the
                  training described.
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-accent"
                  />
                  <span className="text-sm text-gray-900">I attest as above</span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!attested}
                className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
              >
                Sign as Employer
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Not yet signed. (Plan is not in an editable state.)
            </p>
          )}
        </div>

        {/* Student signature */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">
            Student Signature
          </h3>
          <div className="my-3 h-px bg-gray-100" />
          {studentSigned ? (
            <div className="text-sm text-gray-700">
              ✓ Signed by{' '}
              <span className="font-medium">
                {plan.studentSignedName ?? '—'}
              </span>
              <div className="text-xs text-gray-500">
                on {formatFull(plan.studentSignedAt)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Waiting for the candidate to sign from their dashboard.
            </p>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div className="mt-6">
        {employerSigned && studentSigned ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Both signatures captured. This plan is COMPLETE and ready for DSO
            submission.
          </div>
        ) : !employerSigned && !studentSigned ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            No signatures yet.
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Awaiting other signature.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSignEmployer}
        title="Sign as Employer?"
        description={`This electronically signs the Training Plan on behalf of ${plan.entityName ?? 'the employer'}. The signature and timestamp are recorded in the audit log.`}
        confirmLabel="Sign"
        variant="primary"
      />
    </>
  );
}

// ── DSO tab ─────────────────────────────────────────────────────────────────

const DSO_OPTIONS: {
  value: DsoResponseRequest['approvalStatus'];
  label: string;
  color: string;
}[] = [
  {
    value: 'APPROVED',
    label: 'Approved',
    color: 'bg-green-50 border-green-200',
  },
  { value: 'REJECTED', label: 'Rejected', color: 'bg-red-50 border-red-200' },
  {
    value: 'AMENDMENT_REQUESTED',
    label: 'Amendment Requested',
    color: 'bg-amber-50 border-amber-200',
  },
];

function DsoTab({
  plan,
  onUpdated,
  onGoToSignatures,
}: {
  plan: I983PlanResponse;
  onUpdated: (updated: I983PlanResponse) => void;
  onGoToSignatures: () => void;
}) {
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [responseChoice, setResponseChoice] = useState<
    DsoResponseRequest['approvalStatus'] | ''
  >('');
  const [responseNotes, setResponseNotes] = useState('');
  const [responseConfirmOpen, setResponseConfirmOpen] = useState(false);

  // State 1 — not yet complete
  if (plan.status !== 'COMPLETE'
      && plan.status !== 'SUBMITTED_TO_DSO'
      && plan.status !== 'DSO_APPROVED'
      && plan.status !== 'DSO_REJECTED'
      && plan.status !== 'AMENDMENT_REQUESTED') {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="text-sm text-gray-700">
          DSO submission unlocks when both signatures are captured.
        </p>
        <button
          type="button"
          onClick={onGoToSignatures}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-dark"
        >
          Go to Signatures →
        </button>
      </div>
    );
  }

  async function handleSubmitToDso() {
    try {
      const res = await api.post<I983PlanResponse>(
        `/api/v1/i983/${plan.id}/submit-to-dso`,
        submissionNotes.trim()
          ? { submissionNotes: submissionNotes.trim() }
          : {}
      );
      toast.success('Marked as submitted to DSO');
      onUpdated(res.data);
      setSubmitConfirmOpen(false);
      setSubmissionNotes('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't submit.");
    }
  }

  async function handleRecordResponse() {
    if (!responseChoice) return;
    try {
      const res = await api.post<I983PlanResponse>(
        `/api/v1/i983/${plan.id}/dso-response`,
        {
          approvalStatus: responseChoice,
          notes: responseNotes.trim() || undefined,
        } satisfies DsoResponseRequest
      );
      toast.success('DSO response recorded');
      onUpdated(res.data);
      setResponseConfirmOpen(false);
      setResponseChoice('');
      setResponseNotes('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't record response.");
    }
  }

  // State 2 — COMPLETE, ready to submit
  if (plan.status === 'COMPLETE') {
    return (
      <>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">
            Ready for DSO Submission
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Submit this plan to {plan.studentFirstName ?? "the student"}&apos;s
            DSO at{' '}
            <span className="font-medium">
              {plan.universityName ?? '(university not yet filled)'}
            </span>{' '}
            via your standard DSO portal. Once submitted there, record it here
            to track the response.
          </p>
          <div className="mt-4">
            <FormField
              label="Internal submission notes (optional)"
              htmlFor="submission-notes"
              helper="Recorded in the audit log; not sent to DSO."
            >
              <textarea
                id="submission-notes"
                rows={3}
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                className="w-full resize-y rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
              />
            </FormField>
          </div>
          <button
            type="button"
            onClick={() => setSubmitConfirmOpen(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            Mark as Submitted to DSO
          </button>
        </div>

        <ConfirmDialog
          open={submitConfirmOpen}
          onClose={() => setSubmitConfirmOpen(false)}
          onConfirm={handleSubmitToDso}
          title="Mark as submitted to DSO?"
          description="This records that you've uploaded the plan to your DSO portal externally. The action is logged in the audit history."
          confirmLabel="Mark Submitted"
          variant="primary"
        />
      </>
    );
  }

  // State 3 — submitted; awaiting/recorded response
  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">DSO Status</h3>
        <div className="my-3 h-px bg-gray-100" />
        <dl className="space-y-3 text-sm">
          {plan.dsoSubmittedAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                Submitted
              </dt>
              <dd className="mt-1 text-gray-900">
                {formatFull(plan.dsoSubmittedAt)}
                {plan.dsoSubmittedByName && (
                  <span className="ml-2 text-xs text-gray-500">
                    by {plan.dsoSubmittedByName}
                  </span>
                )}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Current DSO status
            </dt>
            <dd className="mt-1">
              <DsoStatusBadge status={plan.dsoApprovalStatus} size="md" />
            </dd>
          </div>
          {plan.dsoRespondedAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                DSO responded
              </dt>
              <dd className="mt-1 text-gray-900">
                {formatFull(plan.dsoRespondedAt)}
              </dd>
            </div>
          )}
          {plan.dsoApprovalNotes && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                DSO notes
              </dt>
              <dd className="mt-1 whitespace-pre-line rounded-md border-l-2 border-gray-300 bg-gray-50 px-3 py-2 text-gray-700">
                {plan.dsoApprovalNotes}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">
          {plan.dsoApprovalStatus === 'SUBMITTED'
            ? 'Record DSO Response'
            : 'Update DSO Response'}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {plan.dsoApprovalStatus === 'SUBMITTED'
            ? 'Once the DSO responds, capture their decision and any feedback below.'
            : 'Use this to update if the DSO sent a follow-up after the initial response.'}
        </p>

        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-gray-900">
            DSO Decision
          </div>
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="DSO decision"
          >
            {DSO_OPTIONS.map((opt) => {
              const selected = responseChoice === opt.value;
              return (
                <label
                  key={opt.value}
                  className={
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors ' +
                    (selected ? opt.color : 'border-gray-300 hover:bg-gray-50')
                  }
                >
                  <input
                    type="radio"
                    name="dsoResponse"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setResponseChoice(opt.value)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-accent"
                  />
                  <span className="text-gray-900">{opt.label}</span>
                </label>
              );
            })}
          </div>

          <div className="mt-4">
            <FormField
              label="DSO feedback / instructions"
              htmlFor="dso-response-notes"
              helper="Copy the DSO's response here for the audit record."
            >
              <textarea
                id="dso-response-notes"
                rows={4}
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                className="w-full resize-y rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
              />
            </FormField>
          </div>

          <button
            type="button"
            disabled={!responseChoice}
            onClick={() => setResponseConfirmOpen(true)}
            className={
              'rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ' +
              (responseChoice === 'REJECTED'
                ? 'bg-red-600 hover:bg-red-700'
                : responseChoice === 'AMENDMENT_REQUESTED'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-accent hover:bg-accent-dark')
            }
          >
            Record Response
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={responseConfirmOpen}
        onClose={() => setResponseConfirmOpen(false)}
        onConfirm={handleRecordResponse}
        title="Record DSO response?"
        description={
          responseChoice === 'AMENDMENT_REQUESTED'
            ? 'Marking AMENDMENT_REQUESTED will clear both signatures so corrections can be made and re-signed.'
            : responseChoice === 'REJECTED'
              ? 'Marking REJECTED is terminal — a new plan must be created from scratch.'
              : 'This records the DSO decision in the audit log.'
        }
        confirmLabel="Record"
        variant={responseChoice === 'REJECTED' ? 'danger' : 'primary'}
      />
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function TabBtn({
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

function DetailSkeleton() {
  return (
    <>
      <div className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-12 animate-pulse rounded bg-gray-100" />
          <div className="h-12 animate-pulse rounded bg-gray-100" />
          <div className="h-12 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      <div className="mb-6 flex gap-6 border-b border-gray-200">
        <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="h-64 animate-pulse rounded bg-gray-100" />
    </>
  );
}
