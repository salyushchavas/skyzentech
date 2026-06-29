'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  ExternalLink,
  GitBranch,
  Github,
  GraduationCap,
  PencilLine,
  Plus,
  Send,
  Trash2,
  Video,
} from 'lucide-react';
import api from '@/lib/api';
import InternPageShell from '@/components/intern/InternPageShell';
import type {
  AssignmentSummary,
  ProjectAssignmentStatus,
  TrainerDecision,
} from '../types';

const STATUS_TONE: Record<ProjectAssignmentStatus, string> = {
  ASSIGNED:       'bg-slate-100 text-slate-700',
  IN_PROGRESS:    'bg-amber-100 text-amber-800',
  SUBMITTED:      'bg-slate-100 text-slate-700',
  RETURNED:       'bg-red-100 text-red-800',
  TECH_APPROVED:  'bg-green-100 text-green-800',
  PENDING_VIVA:   'bg-slate-100 text-slate-700',
  COMPLETED:      'bg-green-100 text-green-800',
};

const STATUS_LABEL: Record<ProjectAssignmentStatus, string> = {
  ASSIGNED:       'Assigned',
  IN_PROGRESS:    'In progress',
  SUBMITTED:      'Submitted — awaiting review',
  RETURNED:       'Returned for revisions',
  TECH_APPROVED:  'Tech approved',
  PENDING_VIVA:   'Pending viva',
  COMPLETED:      'Completed',
};

const DECISION_LABEL: Record<TrainerDecision, string> = {
  ACCEPT:           'Accepted',
  REQUEST_REVISION: 'Changes requested',
  ESCALATE:         'Escalated',
  NO_ACTION_YET:    'No action yet',
};

export default function InternProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<AssignmentSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      // No dedicated single-assignment intern endpoint — pull from /mine
      // and find ours. /mine is already owner-scoped server-side.
      const res = await api.get<AssignmentSummary[]>('/api/v1/project-assignments/mine');
      const found = (res.data ?? []).find((x) => x.id === id) ?? null;
      if (!found) {
        setErr('Project not found, or it is not assigned to you.');
      } else {
        setData(found);
        setErr(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load this project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return (
      <InternPageShell title="Project">
        <div className="h-48 animate-pulse rounded-lg bg-slate-100" aria-hidden />
      </InternPageShell>
    );
  }
  if (err || !data) {
    return (
      <InternPageShell title="Project">
        <BackLink />
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {err ?? 'Project not found'}
        </p>
      </InternPageShell>
    );
  }

  const name = data.project?.name ?? 'Project';

  return (
    <InternPageShell title={name} subtitle={data.project?.techStack ?? undefined}>
      <BackLink />
      <StatusBar a={data} />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <main className="lg:col-span-2 space-y-6">
          <DescriptionCard a={data} />
          <TrainerFeedbackCard a={data} />
          <SubmissionCard a={data} onChanged={(next) => setData(next)} />
        </main>
        <aside className="space-y-6">
          <MetaCard a={data} />
          <KtCard a={data} />
          <RepositoryCard a={data} />
        </aside>
      </div>
    </InternPageShell>
  );
}

// ── Sub-cards ─────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/careers/intern/projects"
      className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
    >
      <ChevronLeft className="h-4 w-4" /> My Projects
    </Link>
  );
}

function StatusBar({ a }: { a: AssignmentSummary }) {
  const revisionRequested =
    a.latestSubmission?.trainerDecision === 'REQUEST_REVISION';
  const accepted = a.latestSubmission?.trainerDecision === 'ACCEPT';
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + STATUS_TONE[a.status]}>
        {STATUS_LABEL[a.status]}
      </span>
      {revisionRequested && a.status !== 'RETURNED' && (
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
          Trainer requested changes
        </span>
      )}
      {accepted && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
          <CheckCircle2 className="h-3 w-3" /> Trainer accepted
        </span>
      )}
      {a.dueDate && <DueChip iso={a.dueDate} submittedAt={a.submittedAt} />}
    </div>
  );
}

function DueChip({ iso, submittedAt }: { iso: string; submittedAt: string | null }) {
  const due = new Date(iso + 'T23:59:59').getTime();
  const ref = submittedAt ? new Date(submittedAt).getTime() : Date.now();
  const overdue = ref > due;
  return (
    <span className={
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium '
      + (overdue ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700')
    }>
      <Clock className="h-3 w-3" />
      {overdue
        ? (submittedAt ? 'Submitted late' : 'Past due')
        : 'Due ' + formatDate(iso)}
    </span>
  );
}

function DescriptionCard({ a }: { a: AssignmentSummary }) {
  const p = a.project;
  if (!p) return null;
  const blocks: { label: string; value: string | null | undefined }[] = [
    { label: 'Description', value: p.description },
    { label: 'Requirements', value: p.requirements },
    { label: 'Objectives', value: p.objectives },
    { label: 'Deliverables', value: p.deliverables },
    { label: 'Instructions', value: p.instructions },
  ];
  const present = blocks.filter((b) => b.value && b.value.trim() !== '');
  if (present.length === 0) {
    return null;
  }
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">About this project</h3>
      <dl className="mt-3 space-y-3">
        {present.map((b) => (
          <div key={b.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {b.label}
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
              {b.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TrainerFeedbackCard({ a }: { a: AssignmentSummary }) {
  const sub = a.latestSubmission;
  if (!sub || !sub.trainerDecision || sub.trainerDecision === 'NO_ACTION_YET') {
    return null;
  }
  const decision = sub.trainerDecision;
  const tone =
    decision === 'ACCEPT' ? 'border-green-200 bg-green-50 text-green-900'
    : decision === 'REQUEST_REVISION' ? 'border-red-200 bg-red-50 text-red-900'
    : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <section className={'rounded-lg border p-5 shadow-sm ' + tone}>
      <div className="flex items-center gap-2">
        {decision === 'ACCEPT'
          ? <CheckCircle2 className="h-4 w-4" />
          : <AlertTriangle className="h-4 w-4" />}
        <h3 className="text-sm font-semibold">
          Feedback from trainer · {DECISION_LABEL[decision]}
        </h3>
      </div>
      {sub.trainerFeedback && (
        <p className="mt-2 whitespace-pre-wrap text-sm">
          {sub.trainerFeedback}
        </p>
      )}
      <p className="mt-3 text-[11px] opacity-80">
        On v{sub.version}
        {sub.reviewedByName ? ' · ' + sub.reviewedByName : ''}
        {sub.reviewedAt ? ' · ' + formatInstant(sub.reviewedAt) : ''}
      </p>
    </section>
  );
}

function SubmissionCard({
  a, onChanged,
}: { a: AssignmentSummary; onChanged: (next: AssignmentSummary) => void }) {
  const status = a.status;
  const revisionRequested =
    a.latestSubmission?.trainerDecision === 'REQUEST_REVISION';

  // Submitable when intern hasn't sent yet (IN_PROGRESS / RETURNED) or
  // when trainer requested revisions on the latest submission.
  const canSubmit =
    status === 'IN_PROGRESS'
    || status === 'RETURNED'
    || (status === 'SUBMITTED' && revisionRequested);

  // What they last sent — surfaced read-only when not currently submitable.
  const lastSent = a.latestSubmission;

  // ASSIGNED gets the dedicated Get-Started card (GitHub username capture +
  // access-granted wait + Start button) instead of the static placeholder.
  if (status === 'ASSIGNED') {
    return <GetStartedCard a={a} onChanged={onChanged} />;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">
        {canSubmit
          ? (lastSent ? 'Re-submit your work' : 'Submit your work')
          : 'Your submission'}
      </h3>
      {canSubmit ? (
        <SubmissionForm
          assignmentId={a.id}
          initialLinks={lastSent?.links ?? ['']}
          initialNotes={lastSent?.description ?? ''}
          isResubmit={Boolean(lastSent)}
          onSubmitted={onChanged}
        />
      ) : lastSent ? (
        <ReadOnlySubmission sub={lastSent} />
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Nothing to submit at this stage.
        </p>
      )}
    </section>
  );
}

/**
 * Three-stage gate on the ASSIGNED state, matching the backend's
 * {@code ProjectAssignmentService.startAssignment} preconditions:
 *   1. intern has a GitHub username on file
 *   2. trainer has flipped {@code accessGranted=true}
 *   3. intern clicks Start
 * Each stage exposes the right action when it's the next step, and the
 * Start button only enables when both upstream stages are satisfied.
 */
function GetStartedCard({
  a, onChanged,
}: { a: AssignmentSummary; onChanged: (next: AssignmentSummary) => void }) {
  const initialUsername = a.intern?.githubUsername?.trim() ?? '';
  const [savedUsername, setSavedUsername] = useState(initialUsername);
  const [editingUsername, setEditingUsername] = useState(initialUsername === '');
  const [usernameDraft, setUsernameDraft] = useState(initialUsername);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameErr, setUsernameErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState<string | null>(null);

  const accessGranted = a.accessGranted === true;
  const hasUsername = savedUsername.trim() !== '';
  const canStart = hasUsername && accessGranted;
  const usernameDraftValid = isValidGitHubUsername(usernameDraft);

  async function saveUsername() {
    if (!usernameDraftValid) return;
    setSavingUsername(true);
    setUsernameErr(null);
    try {
      const res = await api.put<{ githubUsername: string }>(
        '/api/v1/users/me/github-username',
        { githubUsername: usernameDraft.trim() },
      );
      const stored = res.data?.githubUsername ?? usernameDraft.trim();
      setSavedUsername(stored);
      setUsernameDraft(stored);
      setEditingUsername(false);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setUsernameErr(
        ax.response?.data?.error
          ?? (e instanceof Error ? e.message : 'Could not save GitHub username'),
      );
    } finally {
      setSavingUsername(false);
    }
  }

  async function startProject() {
    if (!canStart) return;
    setStarting(true);
    setStartErr(null);
    try {
      const res = await api.post<AssignmentSummary>(
        `/api/v1/project-assignments/${a.id}/start`,
      );
      onChanged(res.data);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setStartErr(
        ax.response?.data?.error
          ?? (e instanceof Error ? e.message : 'Could not start the project'),
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Get started</h3>
      <p className="mt-1 text-sm text-slate-600">
        Add your GitHub username so your trainer can grant you repo access.
        Once they do, you can start the project.
      </p>

      {/* Stage 1 — GitHub username */}
      <div className="mt-4">
        <label
          htmlFor="ghu"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          1. Your GitHub username
        </label>
        {editingUsername ? (
          <div className="mt-1 flex flex-wrap items-start gap-2">
            <div className="flex-1 min-w-[12rem]">
              <input
                id="ghu"
                type="text"
                value={usernameDraft}
                onChange={(e) =>
                  setUsernameDraft(e.target.value.replace(/\s+/g, ''))
                }
                placeholder="octocat"
                autoComplete="off"
                spellCheck={false}
                className={
                  'w-full rounded-md border px-3 py-2 text-sm '
                  + (usernameErr || (usernameDraft && !usernameDraftValid)
                      ? 'border-red-400'
                      : 'border-slate-200')
                }
              />
              {usernameDraft && !usernameDraftValid && (
                <p className="mt-1 text-xs text-red-700">
                  Letters, numbers and single hyphens only; max 39 characters.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={saveUsername}
              disabled={savingUsername || !usernameDraftValid}
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {savingUsername ? 'Saving…' : 'Save'}
            </button>
            {hasUsername && (
              <button
                type="button"
                onClick={() => {
                  setUsernameDraft(savedUsername);
                  setEditingUsername(false);
                  setUsernameErr(null);
                }}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="inline-flex items-center gap-2 text-sm text-slate-800">
              <Github className="h-4 w-4 text-slate-500" />
              <code className="font-mono">{savedUsername}</code>
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingUsername(true);
                setUsernameErr(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              <PencilLine className="h-3 w-3" /> Edit
            </button>
          </div>
        )}
        {usernameErr && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {usernameErr}
          </p>
        )}
      </div>

      {/* Stage 2 — repo access */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          2. Repo access
        </p>
        {accessGranted ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Trainer has granted you repo access.
          </p>
        ) : (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-amber-700">
            <Clock className="h-4 w-4" />
            {hasUsername
              ? 'Waiting for your trainer to grant repo access.'
              : 'Save your GitHub username so your trainer can invite you.'}
          </p>
        )}
      </div>

      {/* Stage 3 — start */}
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          {canStart
            ? 'Everything ready — start the project to enable submissions.'
            : 'Complete the steps above to enable Start.'}
        </p>
        <button
          type="button"
          onClick={startProject}
          disabled={starting || !canStart}
          title={!canStart
            ? 'Add your GitHub username and wait for trainer access first'
            : undefined}
          className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {starting ? 'Starting…' : 'Start project'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {startErr && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {startErr}
        </p>
      )}
    </section>
  );
}

/**
 * GitHub username validation — mirrors the backend's @Pattern on
 * SetGithubUsernameRequest. Letters, digits and single hyphens, no
 * leading/trailing hyphen, 1-39 chars.
 */
function isValidGitHubUsername(s: string): boolean {
  const v = s.trim();
  if (v.length === 0 || v.length > 39) return false;
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(v);
}

function ReadOnlySubmission({ sub }: { sub: NonNullable<AssignmentSummary['latestSubmission']> }) {
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-500">
        Submitted {formatInstant(sub.submittedAt)} · v{sub.version}
      </p>
      {sub.links.length > 0 && (
        <ul className="space-y-1.5">
          {sub.links.map((l) => (
            <li key={l}>
              <a
                href={l}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 break-all text-sm text-brand-700 hover:underline"
              >
                <GitBranch className="h-3 w-3" /> {l}
              </a>
            </li>
          ))}
        </ul>
      )}
      {sub.description && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Notes
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
            {sub.description}
          </p>
        </div>
      )}
    </div>
  );
}

function SubmissionForm({
  assignmentId, initialLinks, initialNotes, isResubmit, onSubmitted,
}: {
  assignmentId: string;
  initialLinks: string[];
  initialNotes: string;
  isResubmit: boolean;
  onSubmitted: (next: AssignmentSummary) => void;
}) {
  const [links, setLinks] = useState<string[]>(
    initialLinks.length > 0 ? initialLinks : ['']);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trimmedLinks = useMemo(
    () => links.map((l) => l.trim()).filter((l) => l !== ''),
    [links],
  );
  const linkErrors = useMemo(() => trimmedLinks.map(validateUrl), [trimmedLinks]);
  const hasInvalidUrl = linkErrors.some((e) => e !== null);
  const hasContent = trimmedLinks.length > 0 || notes.trim().length > 0;

  function setLinkAt(i: number, v: string) {
    setLinks((prev) => prev.map((p, idx) => (idx === i ? v : p)));
  }
  function addLink() {
    setLinks((prev) => [...prev, '']);
  }
  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!hasContent || hasInvalidUrl) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post<AssignmentSummary>(
        `/api/v1/project-assignments/${assignmentId}/submit`,
        {
          submissionNotes: notes.trim() || null,
          deliverableLinks: trimmedLinks,
        },
      );
      onSubmitted(res.data);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(
        ax.response?.data?.error
          ?? (e instanceof Error ? e.message : 'Submit failed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-4">
      {isResubmit && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          The trainer requested changes on your previous submission. Update
          your links / notes and re-submit.
        </p>
      )}

      <div>
        <label className="text-sm font-medium text-slate-800">
          Deliverable links
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          GitHub repo, pull request, deployed demo, docs — full https:// URLs.
        </p>
        <div className="mt-2 space-y-2">
          {links.map((l, i) => {
            const trimmed = l.trim();
            const invalid = trimmed !== '' && validateUrl(trimmed) !== null;
            return (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    type="url"
                    value={l}
                    onChange={(e) => setLinkAt(i, e.target.value)}
                    placeholder="https://github.com/you/your-repo"
                    className={
                      'w-full rounded-md border px-3 py-2 text-sm '
                      + (invalid ? 'border-red-400' : 'border-slate-200')
                    }
                  />
                  {invalid && (
                    <p className="mt-1 text-xs text-red-700">
                      {validateUrl(trimmed)}
                    </p>
                  )}
                </div>
                {links.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    aria-label="Remove link"
                    className="mt-1 rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={addLink}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
          >
            <Plus className="h-3 w-3" /> Add another link
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-800">
          Notes <span className="text-xs font-normal text-slate-500">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="What you built, anything you want the trainer to look at first, known gaps…"
          className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      {err && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !hasContent || hasInvalidUrl}
          className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {busy
            ? (isResubmit ? 'Re-submitting…' : 'Submitting…')
            : (isResubmit ? 'Re-submit' : 'Submit')}
        </button>
      </div>
    </div>
  );
}

function MetaCard({ a }: { a: AssignmentSummary }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm">
      <h3 className="text-sm font-semibold text-slate-900">Details</h3>
      <dl className="mt-3 space-y-2 text-xs">
        <Row k="Assigned" v={a.assignmentDate ? formatDate(a.assignmentDate) : '—'} />
        <Row k="Due" v={a.dueDate ? formatDate(a.dueDate) : '—'} />
        <Row k="Started" v={a.startedAt ? formatInstant(a.startedAt) : '—'} />
        <Row k="Submitted" v={a.submittedAt ? formatInstant(a.submittedAt) : '—'} />
        {a.project?.difficulty && (
          <Row k="Difficulty" v={a.project.difficulty} />
        )}
        {a.project?.expectedDurationDays && (
          <Row k="Expected" v={`${a.project.expectedDurationDays} days`} />
        )}
      </dl>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right text-slate-800">{v}</dd>
    </div>
  );
}

function RepositoryCard({ a }: { a: AssignmentSummary }) {
  const repo = a.project?.repository;
  if (!repo?.repositoryUrl) return null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Repository</h3>
      <a
        href={repo.repositoryUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 break-all text-sm text-brand-700 hover:underline"
      >
        <Github className="h-4 w-4" />
        {repo.repositoryName ?? repo.repositoryUrl}
        <ExternalLink className="h-3 w-3" />
      </a>
      {a.accessGranted === false && (
        <p className="mt-2 text-xs text-amber-700">
          Repository access not granted yet. Ask your trainer to invite you.
        </p>
      )}
    </section>
  );
}

function KtCard({ a }: { a: AssignmentSummary }) {
  const kt = a.project?.kt;
  if (!kt) return null; // Catalog-only, no assignment → KT is N/A.
  const done = kt.status === 'DONE';
  const hasScheduledSession = !!kt.zoomMeetingId && !!kt.zoomJoinUrl;
  return (
    <section className={
      'rounded-lg border p-5 shadow-sm text-sm '
      + (done
          ? 'border-green-200 bg-green-50'
          : 'border-slate-200 bg-white')
    }>
      <div className="flex items-center gap-2">
        <GraduationCap className={'h-4 w-4 ' + (done ? 'text-green-700' : 'text-slate-500')} />
        <h3 className="text-sm font-semibold text-slate-900">KT session</h3>
        <span className={
          'ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium '
          + (done
              ? 'bg-green-100 text-green-800'
              : 'bg-slate-100 text-slate-700')
        }>
          {done ? 'Done' : 'Not done'}
        </span>
      </div>

      {/* Scheduled live KT session (Zoom). Shown WHENEVER one exists —
          independent of done/not-done; trainer can mark done at any time
          regardless of whether a session was conducted. */}
      {hasScheduledSession && (
        <div className="mt-3 rounded-md border border-brand-200 bg-brand-50 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">
              Live KT session
            </p>
            {kt.scheduledFor && (
              <p className="text-[11px] text-slate-700">
                {new Date(kt.scheduledFor).toLocaleString()}
                {kt.timezone ? ` (${kt.timezone})` : ''}
                {kt.durationMinutes ? ` · ${kt.durationMinutes} min` : ''}
              </p>
            )}
          </div>
          <a
            href={kt.zoomJoinUrl ?? '#'}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
          >
            <Video className="h-3.5 w-3.5" />
            Join Meeting
          </a>
        </div>
      )}

      {done ? (
        <>
          <p className="mt-2 text-xs text-slate-600">
            Marked on {kt.completedAt ? formatInstant(kt.completedAt) : '—'}
            {kt.markedByName ? ' · by ' + kt.markedByName : ''}
          </p>
          {kt.meetingLink && (
            <a
              href={kt.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 break-all text-xs text-brand-700 hover:underline"
            >
              <Video className="h-3 w-3" /> {kt.meetingLink}
            </a>
          )}
          {kt.notes && (
            <div className="mt-2 rounded-md border border-green-200 bg-white p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
                {kt.notes}
              </p>
            </div>
          )}
        </>
      ) : !hasScheduledSession ? (
        <p className="mt-2 text-xs text-slate-500">
          Your trainer will schedule a Knowledge Transfer session to walk
          you through the project, then mark it done here.
        </p>
      ) : null}
    </section>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function validateUrl(s: string): string | null {
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return 'Must be an http:// or https:// URL';
    }
    if (!u.hostname) return 'URL is missing a hostname';
    return null;
  } catch {
    return 'Not a valid URL';
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
}

function formatInstant(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return iso; }
}
