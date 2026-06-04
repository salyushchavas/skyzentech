'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import FormField, { inputClass } from '@/components/ui/FormField';
import I9StatusBadge from '@/components/i9/I9StatusBadge';
import AuditHistoryList from '@/components/i9/AuditHistoryList';
import EVerifyStatusBadge from '@/components/everify/EVerifyStatusBadge';
import EVerifyPhaseBadge from '@/components/everify/EVerifyPhaseBadge';
import CloseCaseDialog from '@/components/everify/CloseCaseDialog';
import { formatDateOnly, formatRelative } from '@/lib/format-date';
import type {
  EVerifyCaseResponse,
  EVerifyHistoryEntryResponse,
  EVerifyStatus,
  I9FormResponse,
  PhotoMatchResult,
  UpdateEVerifyCaseRequest,
} from '@/types';

type Tab = 'details' | 'status' | 'history';
const VALID_TABS: Tab[] = ['details', 'status', 'history'];

// Allowed forward transitions from each status (mirror backend).
const NEXT_STATUSES: Record<EVerifyStatus, EVerifyStatus[]> = {
  PENDING_SUBMISSION: ['OPEN'],
  OPEN: ['EMPLOYMENT_AUTHORIZED', 'TENTATIVE_NONCONFIRMATION'],
  TENTATIVE_NONCONFIRMATION: [
    'EMPLOYMENT_AUTHORIZED',
    'FINAL_NONCONFIRMATION',
  ],
  EMPLOYMENT_AUTHORIZED: ['CLOSED'],
  FINAL_NONCONFIRMATION: ['CLOSED'],
  CLOSED: [],
};

const STATUS_LABEL: Record<EVerifyStatus, string> = {
  PENDING_SUBMISSION: 'Pending Submission',
  OPEN: 'Open',
  EMPLOYMENT_AUTHORIZED: 'Employment Authorized',
  TENTATIVE_NONCONFIRMATION: 'Tentative Non-confirmation',
  FINAL_NONCONFIRMATION: 'Final Non-confirmation',
  CLOSED: 'Closed',
};

export default function EVerifyDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['ERM']}>
      <DashboardLayout title="E-Verify Case">
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

  const { user } = useAuth();
  const canWrite =
    user?.roles?.some((r) => r === 'ERM') ?? false;

  const [caseData, setCaseData] = useState<EVerifyCaseResponse | null>(null);
  const [i9, setI9] = useState<I9FormResponse | null>(null);
  const [history, setHistory] = useState<EVerifyHistoryEntryResponse[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('details');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const caseRes = await api.get<EVerifyCaseResponse>(
        `/api/v1/everify/${id}`
      );
      setCaseData(caseRes.data);
      const [hRes, i9Res] = await Promise.all([
        api.get<EVerifyHistoryEntryResponse[]>(`/api/v1/everify/${id}/history`),
        api.get<I9FormResponse>(`/api/v1/i9/${caseRes.data.i9FormId}`),
      ]);
      setHistory(hRes.data ?? []);
      setI9(i9Res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load this case.");
      setCaseData(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromHash = window.location.hash.replace('#', '');
    if (VALID_TABS.includes(fromHash as Tab)) {
      setTab(fromHash as Tab);
    }
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#' + next);
    }
  }

  function refreshHistory() {
    if (!id) return;
    void api
      .get<EVerifyHistoryEntryResponse[]>(`/api/v1/everify/${id}/history`)
      .then((res) => setHistory(res.data ?? []))
      .catch(() => {});
  }

  if (caseData === null && !error) return <DetailSkeleton />;

  if (error && !caseData) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{error}</p>
        <Link
          href="/careers/erm/i9-everify#everify"
          className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
        >
          Back to E-Verify list
        </Link>
      </div>
    );
  }

  if (!caseData) return null;

  return (
    <>
      <Link
        href="/careers/erm/i9-everify#everify"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to E-Verify list
      </Link>

      {/* Header card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {caseData.candidateName ?? '(unnamed candidate)'}
            </h2>
            {caseData.candidateEmail && (
              <div className="text-sm text-gray-500">
                {caseData.candidateEmail}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EVerifyPhaseBadge phase={caseData.phase} size="md" />
            <EVerifyStatusBadge status={caseData.status} size="md" />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Stat
            label="Case number"
            value={
              caseData.caseNumber ? (
                <span className="font-mono">{caseData.caseNumber}</span>
              ) : (
                <span className="italic text-gray-400">
                  Not yet assigned
                </span>
              )
            }
          />
          <Stat
            label="Opened"
            value={
              caseData.openedAt ? formatDateOnly(caseData.openedAt) : '—'
            }
          />
          <Stat
            label="Federal deadline"
            value={
              caseData.dueBy ? (
                <span
                  className={
                    caseData.overdue
                      ? 'font-medium text-red-700'
                      : 'text-gray-900'
                  }
                >
                  {formatDateOnly(caseData.dueBy)}
                  {caseData.overdue && (
                    <span className="ml-2 text-xs uppercase tracking-wide">
                      Overdue
                    </span>
                  )}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Stat
            label="Days open"
            value={
              caseData.daysOpen != null
                ? `${caseData.daysOpen} day${caseData.daysOpen === 1 ? '' : 's'}`
                : '—'
            }
          />
        </dl>

        {caseData.overdue && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              Federal deadline passed — this case should already be authorized.
              Submit / chase status now.
            </span>
          </div>
        )}

        {caseData.status === 'TENTATIVE_NONCONFIRMATION' && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              Tentative Non-confirmation issued. Employee has 8 federal working
              days to contest. Coordinate immediately.
            </span>
          </div>
        )}
        {caseData.status === 'FINAL_NONCONFIRMATION' && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span>
              Final Non-confirmation. Per E-Verify rules, you may terminate
              employment for cause. Document the action thoroughly.
            </span>
          </div>
        )}
      </div>

      {/* Two-column main */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT — Linked I-9 panel */}
        <aside className="lg:col-span-1">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900">
              Linked I-9 Form
            </h3>
            <div className="my-3 h-px bg-gray-100" />
            {i9 ? (
              <>
                <div className="mb-2">
                  <I9StatusBadge status={i9.status} />
                </div>
                <div className="text-xs text-gray-500">
                  Section 2 signed
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {i9.section2SignedAt
                    ? formatDateOnly(i9.section2SignedAt)
                    : '—'}
                </div>
                <Link
                  href={`/careers/erm/i9-everify/i9/${i9.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-dark"
                >
                  View I-9 form
                  <ExternalLink className="h-3 w-3" strokeWidth={2} />
                </Link>
              </>
            ) : (
              <p className="text-xs text-gray-500">Loading I-9 details…</p>
            )}
          </div>
        </aside>

        {/* RIGHT — Tabs */}
        <div className="lg:col-span-2">
          <div className="mb-6 flex gap-6 border-b border-gray-200">
            <TabButton
              active={tab === 'details'}
              onClick={() => switchTab('details')}
            >
              Case Details
            </TabButton>
            <TabButton
              active={tab === 'status'}
              onClick={() => switchTab('status')}
            >
              Update Status
            </TabButton>
            <TabButton
              active={tab === 'history'}
              onClick={() => switchTab('history')}
            >
              History
            </TabButton>
          </div>

          {tab === 'details' && (
            <CaseDetailsTab
              caseData={caseData}
              canWrite={canWrite}
              onUpdated={(updated) => {
                setCaseData(updated);
                refreshHistory();
              }}
            />
          )}

          {tab === 'status' && (
            <UpdateStatusTab
              caseData={caseData}
              canWrite={canWrite}
              onUpdated={(updated) => {
                setCaseData(updated);
                refreshHistory();
                switchTab('history');
              }}
            />
          )}

          {tab === 'history' && (
            <>
              {history === null ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : (
                <AuditHistoryList entries={history} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Case Details tab ────────────────────────────────────────────────────────

function CaseDetailsTab({
  caseData,
  canWrite,
  onUpdated,
}: {
  caseData: EVerifyCaseResponse;
  canWrite: boolean;
  onUpdated: (updated: EVerifyCaseResponse) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <CaseEditForm
        caseData={caseData}
        onSaved={(updated) => {
          onUpdated(updated);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Submission info
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Pair label="Case number" value={caseData.caseNumber} mono />
          <Pair
            label="Opened"
            value={
              caseData.openedAt ? formatDateOnly(caseData.openedAt) : '—'
            }
          />
          <Pair
            label="Photo match required"
            value={caseData.photoMatchRequired ? 'Yes' : 'No'}
          />
          <Pair
            label="Photo match result"
            value={
              caseData.photoMatchResult
                ? humanize(caseData.photoMatchResult)
                : '—'
            }
          />
          <Pair
            label="Additional verification required"
            value={caseData.additionalVerificationRequired ? 'Yes' : 'No'}
          />
          {caseData.closureReason && (
            <Pair
              label="Closure reason"
              value={humanize(caseData.closureReason)}
            />
          )}
        </dl>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Notes</h3>
        {caseData.notes && caseData.notes.trim().length > 0 ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-700">
            {caseData.notes}
          </pre>
        ) : (
          <p className="text-sm italic text-gray-400">No notes yet.</p>
        )}
      </div>

      {canWrite && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit Case Details
          </button>
        </div>
      )}
    </>
  );
}

function CaseEditForm({
  caseData,
  onSaved,
  onCancel,
}: {
  caseData: EVerifyCaseResponse;
  onSaved: (updated: EVerifyCaseResponse) => void;
  onCancel: () => void;
}) {
  const [caseNumber, setCaseNumber] = useState(caseData.caseNumber ?? '');
  const [photoMatchRequired, setPhotoMatchRequired] = useState(
    caseData.photoMatchRequired ?? false
  );
  const [photoMatchResult, setPhotoMatchResult] = useState<
    PhotoMatchResult | ''
  >(caseData.photoMatchResult ?? '');
  const [additionalVerificationRequired, setAdditionalVerificationRequired] =
    useState(caseData.additionalVerificationRequired ?? false);
  const [notes, setNotes] = useState(caseData.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: UpdateEVerifyCaseRequest = {
        caseNumber: caseNumber.trim() || undefined,
        photoMatchRequired,
        photoMatchResult: photoMatchResult || undefined,
        additionalVerificationRequired,
        notes,
      };
      const res = await api.patch<EVerifyCaseResponse>(
        `/api/v1/everify/${caseData.id}`,
        body
      );
      toast.success('Case details saved');
      onSaved(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Couldn't save changes.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="rounded-lg border border-gray-200 bg-white p-6"
    >
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        Edit case details
      </h3>

      <FormField
        label="Case number"
        htmlFor="case-number"
        helper="USCIS-issued E-Verify case number. Setting this promotes a PENDING case to OPEN."
      >
        <input
          id="case-number"
          type="text"
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          placeholder="e.g. 2025010100000123ABC"
          className={inputClass() + ' font-mono'}
        />
      </FormField>

      <div className="mb-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={photoMatchRequired}
            onChange={(e) => setPhotoMatchRequired(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-accent"
          />
          <span className="text-sm text-gray-900">Photo match required</span>
        </label>
      </div>

      <FormField
        label="Photo match result"
        htmlFor="photo-match-result"
        helper="Only relevant when photo match is required"
      >
        <select
          id="photo-match-result"
          value={photoMatchResult}
          onChange={(e) =>
            setPhotoMatchResult(e.target.value as PhotoMatchResult)
          }
          className={inputClass()}
          disabled={!photoMatchRequired}
        >
          <option value="">—</option>
          <option value="MATCH">Match</option>
          <option value="NO_MATCH">No match</option>
          <option value="NOT_APPLICABLE">Not applicable</option>
        </select>
      </FormField>

      <div className="mb-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={additionalVerificationRequired}
            onChange={(e) =>
              setAdditionalVerificationRequired(e.target.checked)
            }
            className="mt-0.5 h-4 w-4 cursor-pointer accent-accent"
          />
          <span className="text-sm text-gray-900">
            Additional verification required
          </span>
        </label>
      </div>

      <FormField label="Notes" htmlFor="case-notes">
        <textarea
          id="case-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Free-form notes. Status changes auto-append with a timestamp prefix."
          className="w-full resize-y rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
        />
      </FormField>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

// ── Update Status tab ───────────────────────────────────────────────────────

function UpdateStatusTab({
  caseData,
  canWrite,
  onUpdated,
}: {
  caseData: EVerifyCaseResponse;
  canWrite: boolean;
  onUpdated: (updated: EVerifyCaseResponse) => void;
}) {
  const [picked, setPicked] = useState<EVerifyStatus | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);

  const validTargets = useMemo(
    () => NEXT_STATUSES[caseData.status] ?? [],
    [caseData.status]
  );

  if (caseData.status === 'CLOSED') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-700">
          This case is closed. Contact an ADMIN to reopen if needed.
        </p>
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-700">
          Read-only access — status updates require HR or ADMIN permissions.
        </p>
      </div>
    );
  }

  async function updateStatus() {
    if (!picked) {
      setError('Pick a target status.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch<EVerifyCaseResponse>(
        `/api/v1/everify/${caseData.id}/status`,
        { status: picked, notes: notes.trim() || undefined }
      );
      toast.success(`Status changed to ${STATUS_LABEL[picked as EVerifyStatus]}`);
      onUpdated(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Couldn't update status.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Status update form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void updateStatus();
        }}
        className="rounded-lg border border-gray-200 bg-white p-6"
      >
        <div className="mb-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
            Current status
          </div>
          <EVerifyStatusBadge status={caseData.status} size="md" />
        </div>

        {validTargets.length === 0 ? (
          <p className="text-sm text-gray-500">
            No forward transitions available from this status. Use the Close
            Case action below.
          </p>
        ) : (
          <>
            <div className="mb-2 text-sm font-medium text-gray-900">
              Change status to
            </div>
            <div
              className="space-y-2"
              role="radiogroup"
              aria-label="New status"
            >
              {validTargets.map((s) => {
                const selected = picked === s;
                return (
                  <label
                    key={s}
                    className={
                      'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors ' +
                      (selected
                        ? 'border-accent bg-accent/5'
                        : 'border-gray-300 hover:bg-gray-50')
                    }
                  >
                    <input
                      type="radio"
                      name="newStatus"
                      value={s}
                      checked={selected}
                      onChange={() => setPicked(s)}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-accent"
                    />
                    <span className="text-gray-900">{STATUS_LABEL[s]}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-4">
              <FormField
                label="Notes (optional)"
                htmlFor="status-notes"
                helper="Appended to existing notes with a timestamp + your name."
              >
                <textarea
                  id="status-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-md border border-gray-300 p-2.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
                />
              </FormField>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving || !picked}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
              >
                {saving ? 'Updating…' : 'Update Status'}
              </button>
            </div>
          </>
        )}
      </form>

      {/* Close case section */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">Close this case</h3>
        <p className="mt-1 text-sm text-gray-500">
          Final action — closes the case in our records. Use this when you have
          successfully closed the case in real E-Verify.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setCloseOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Close Case
          </button>
        </div>
      </div>

      <CloseCaseDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onClosed={(updated) => onUpdated(updated)}
        caseId={caseData.id}
      />
    </>
  );
}

// ── UI primitives ───────────────────────────────────────────────────────────

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

function Pair({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd
        className={
          'mt-1 text-sm font-medium text-gray-900 ' +
          (mono ? 'font-mono' : '')
        }
      >
        {value && value.trim().length > 0 ? value : '—'}
      </dd>
    </div>
  );
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

function humanize(raw: string): string {
  return raw
    .split('_')
    .map((p) => (p ? p[0] + p.slice(1).toLowerCase() : p))
    .join(' ');
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-40 animate-pulse rounded bg-gray-100" />
        <div className="space-y-3 lg:col-span-2">
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-40 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    </>
  );
}
