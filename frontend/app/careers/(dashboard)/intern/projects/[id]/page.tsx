'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Github,
  Lock,
  Mail,
  Send,
} from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Avatar,
  Banner,
  Button,
  Card,
  CardHeader,
  Input,
  Label,
  PageHeader,
  Skeleton,
  StatusPill,
  Textarea,
  toast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDateOnly } from '@/lib/format-date';
import type { ProjectAssignment } from '../page';

/**
 * Intern detail page. The {@code [id]} parameter is the
 * {@code project_assignments.id} — NOT the legacy project id. The page
 * reads exclusively from {@code GET /api/v1/project-assignments/{id}}
 * which returns the assignment + nested project + repository + assignedBy.
 *
 * <p>Polls every 30s so TE-side mutations (access-granted, status flips)
 * surface without manual refresh.</p>
 *
 * <p>Single "Your next step" panel below the metadata replaces the legacy
 * row of competing buttons. The state machine drives one primary action
 * at a time.</p>
 */
export default function CandidateProjectAssignmentDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['INTERN', 'APPLICANT']}>
      <DashboardLayout title="Project">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

const POLL_MS = 30_000;

function Body() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<ProjectAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<ProjectAssignment>(
        `/api/v1/project-assignments/${encodeURIComponent(id)}`,
      );
      setData(res.data);
      setError(null);
    } catch (err: any) {
      if (data == null) {
        const status = err?.response?.status;
        if (status === 403) setError("You don't have access to this project.");
        else if (status === 404) setError('Project assignment not found.');
        else setError(err?.response?.data?.error ?? "Couldn't load this project.");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void load();
    if (!document.hidden) {
      intervalRef.current = window.setInterval(() => void load(), POLL_MS);
    }
    const onVis = () => {
      if (document.hidden && intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else if (!document.hidden) {
        void load();
        if (intervalRef.current == null) {
          intervalRef.current = window.setInterval(() => void load(), POLL_MS);
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    };
  }, [load]);

  if (error && data == null) {
    return <Banner variant="danger" title="Couldn't open this project" description={error} />;
  }
  if (data == null) return <DetailSkeleton />;

  const p = data.project;

  return (
    <section className="space-y-6">
      <Link
        href="/careers/candidate/projects"
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2.5} />
        Back to projects
      </Link>

      <PageHeader
        breadcrumb={[
          { label: 'Dashboard', href: '/careers/candidate' },
          { label: 'Projects', href: '/careers/candidate/projects' },
          { label: p?.name ?? 'Project' },
        ]}
        title={p?.name ?? 'Project unavailable'}
        meta={<StatusPill status={data.status} size="md" />}
      />

      {!p && (
        <Banner
          variant="warning"
          title="Project metadata unavailable"
          description="The linked project row could not be loaded. This is rare — contact your Technical Evaluator if it persists."
        />
      )}

      {p && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <MetadataSection title="About this project" body={p.description} />
            <MetadataSection title="Requirements" body={p.requirements} />
            <MetadataSection title="Objectives" body={p.objectives} />
            <MetadataSection title="Deliverables" body={p.deliverables} />
            <MetadataSection title="Instructions" body={p.instructions} />
          </div>
          <aside className="space-y-4 lg:col-span-2">
            <RepositoryCard repository={p.repository} />
            <StatusCard assignment={data} />
            <AssignedByCard user={data.assignedBy} />
          </aside>
        </div>
      )}

      <NextStepPanel assignment={data} onChanged={() => void load()} />
    </section>
  );
}

// ── Metadata section ──────────────────────────────────────────────────────

function MetadataSection({
  title,
  body,
}: {
  title: string;
  body: string | null | undefined;
}) {
  if (!body || !body.trim()) return null;
  return (
    <Card>
      <CardHeader title={title} />
      <p className="whitespace-pre-line text-sm text-slate-700">{body}</p>
    </Card>
  );
}

// ── Sidebar cards ─────────────────────────────────────────────────────────

function RepositoryCard({
  repository,
}: {
  repository: { repositoryName: string | null; repositoryUrl: string | null } | null;
}) {
  if (!repository?.repositoryUrl) {
    return (
      <Card>
        <CardHeader title="Repository" eyebrow="Code" />
        <Banner
          variant="warning"
          title="Repository not yet linked"
          description="Your Technical Evaluator will link the repository for this project shortly."
        />
      </Card>
    );
  }
  const url = repository.repositoryUrl;
  const name = repository.repositoryName ?? url;
  const cloneCmd = `git clone ${url}`;

  async function copyClone() {
    try {
      await navigator.clipboard.writeText(cloneCmd);
      toast.success('Clone command copied');
    } catch {
      toast.error('Copy failed — copy manually');
    }
  }

  return (
    <Card>
      <CardHeader title="Repository" eyebrow={<><Github className="mr-1 inline h-3 w-3" /> Code</>} />
      <p className="break-all font-mono text-xs text-slate-700">{name}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <ExternalLink className="h-3 w-3" strokeWidth={2.5} />
          Open repository
        </a>
        <button
          type="button"
          onClick={() => void copyClone()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <Clipboard className="h-3 w-3" strokeWidth={2.5} />
          Copy clone command
        </button>
      </div>
    </Card>
  );
}

function StatusCard({ assignment }: { assignment: ProjectAssignment }) {
  const daysRemaining = daysUntil(assignment.dueDate);
  return (
    <Card>
      <CardHeader title="Status" />
      <dl className="space-y-2.5 text-sm">
        <DLRow label="Status"><StatusPill status={assignment.status} /></DLRow>
        <DLRow label="Assigned">{formatDateOnly(assignment.assignmentDate) ?? '—'}</DLRow>
        <DLRow label="Due">
          {assignment.dueDate ? (
            <>
              {formatDateOnly(assignment.dueDate)}
              {typeof daysRemaining === 'number' && (
                <span className={daysRemaining < 0 ? 'ml-1 text-red-700' : 'ml-1 text-slate-500'}>
                  ({daysRemaining < 0
                    ? `${Math.abs(daysRemaining)}d overdue`
                    : `${daysRemaining}d left`})
                </span>
              )}
            </>
          ) : (
            '—'
          )}
        </DLRow>
        {assignment.startedAt && (
          <DLRow label="Started">{formatDateOnly(assignment.startedAt)}</DLRow>
        )}
        {assignment.submittedAt && (
          <DLRow label="Submitted">{formatDateOnly(assignment.submittedAt)}</DLRow>
        )}
      </dl>
    </Card>
  );
}

function DLRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function AssignedByCard({
  user,
}: {
  user: ProjectAssignment['assignedBy'];
}) {
  if (!user) return null;
  return (
    <Card>
      <CardHeader title="Assigned by" />
      <div className="flex items-center gap-3">
        <Avatar name={user.fullName} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{user.fullName ?? '—'}</p>
          {user.email && (
            <p className="flex items-center gap-1 truncate text-xs text-slate-500">
              <Mail className="h-3 w-3" strokeWidth={2} />
              {user.email}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── State-branched next-step panel ────────────────────────────────────────

function NextStepPanel({
  assignment,
  onChanged,
}: {
  assignment: ProjectAssignment;
  onChanged: () => void;
}) {
  const status = assignment.status;
  const accessGranted = !!assignment.accessGranted;
  const internGithub = assignment.intern?.githubUsername ?? null;

  if (status === 'ASSIGNED' && !accessGranted) {
    return (
      <PanelShell
        accent="warning"
        title="Waiting for repository access"
        body="Your Technical Evaluator will grant access to the repository shortly. You'll be notified."
        action={
          <Button disabled title="Waiting on TE to grant repository access.">
            <Lock className="mr-1 h-3 w-3" />
            Start project
          </Button>
        }
      />
    );
  }

  if (status === 'ASSIGNED' && accessGranted && !internGithub) {
    return <SetGithubUsernamePanel onChanged={onChanged} />;
  }

  if (status === 'ASSIGNED' && accessGranted && internGithub) {
    return <StartPanel assignmentId={assignment.id} onChanged={onChanged} />;
  }

  if (status === 'IN_PROGRESS') {
    return <SubmitPanel assignmentId={assignment.id} onChanged={onChanged} resubmit={false} />;
  }

  if (status === 'SUBMITTED') {
    return (
      <PanelShell
        accent="info"
        title="Awaiting tech review"
        body="Your Technical Evaluator will review your work shortly. You'll be notified."
      />
    );
  }

  if (status === 'RETURNED') {
    return (
      <PanelShell
        accent="warning"
        title="Returned for revisions"
        body={
          assignment.submissionNotes
            ? assignment.submissionNotes
            : 'Your reviewer returned this assignment. Update your work and resubmit.'
        }
        action={
          <SubmitPanelInline assignmentId={assignment.id} onChanged={onChanged} resubmit />
        }
      />
    );
  }

  if (status === 'TECH_APPROVED') {
    return (
      <PanelShell
        accent="info"
        title="Tech approved"
        body="Your work passed technical review. Your Reporting Manager will schedule the viva next."
      />
    );
  }

  if (status === 'PENDING_VIVA') {
    return (
      <PanelShell
        accent="info"
        title="Viva scheduled"
        body="Your Reporting Manager will conduct the viva. Be prepared."
      />
    );
  }

  if (status === 'COMPLETED') {
    return (
      <PanelShell
        accent="success"
        title="Completed"
        body="Congratulations — your project has been signed off."
      />
    );
  }

  return null;
}

function PanelShell({
  accent,
  title,
  body,
  action,
}: {
  accent: 'success' | 'info' | 'warning';
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  const border =
    accent === 'success'
      ? 'border-l-emerald-500'
      : accent === 'warning'
        ? 'border-l-amber-500'
        : 'border-l-blue-500';
  const bg =
    accent === 'success'
      ? 'bg-emerald-50'
      : accent === 'warning'
        ? 'bg-amber-50'
        : 'bg-blue-50';
  return (
    <Card className={cn('border-l-4 p-5', border, bg)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Your next step
      </p>
      <h3 className="mt-1 text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-1.5 whitespace-pre-line text-sm text-slate-700">{body}</div>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

function SetGithubUsernamePanel({ onChanged }: { onChanged: () => void }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  async function save() {
    const v = value.trim();
    if (!v) return;
    setSaving(true);
    try {
      await api.put('/api/v1/users/me/github-username', { githubUsername: v });
      toast.success('GitHub username saved.');
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't save your GitHub username.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <PanelShell
      accent="info"
      title="Set your GitHub username"
      body="We need your GitHub username so your Technical Evaluator can grant repository access to your account."
      action={
        <div className="space-y-2">
          <Label htmlFor="gh-username">GitHub username</Label>
          <div className="flex items-center gap-2">
            <Input
              id="gh-username"
              placeholder="octocat"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              leftIcon={<Github className="h-4 w-4" strokeWidth={2} />}
              className="max-w-xs"
            />
            <Button onClick={() => void save()} loading={saving} disabled={!value.trim()}>
              Save
            </Button>
          </div>
        </div>
      }
    />
  );
}

function StartPanel({
  assignmentId,
  onChanged,
}: {
  assignmentId: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      await api.post(`/api/v1/project-assignments/${assignmentId}/start`);
      toast.success('Project started.');
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't start this project.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PanelShell
      accent="success"
      title="You're ready to start"
      body="Repository access granted. Clone the repository and begin working."
      action={
        <Button onClick={() => void start()} loading={busy}>
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Start project
        </Button>
      }
    />
  );
}

function SubmitPanel({
  assignmentId,
  onChanged,
  resubmit,
}: {
  assignmentId: string;
  onChanged: () => void;
  resubmit: boolean;
}) {
  return (
    <PanelShell
      accent="info"
      title="In progress"
      body="Keep working in your repository. When you're ready, submit your work for review."
      action={<SubmitPanelInline assignmentId={assignmentId} onChanged={onChanged} resubmit={resubmit} />}
    />
  );
}

function SubmitPanelInline({
  assignmentId,
  onChanged,
  resubmit,
}: {
  assignmentId: string;
  onChanged: () => void;
  resubmit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/api/v1/project-assignments/${assignmentId}/submit`, {
        submissionNotes: notes.trim() || undefined,
      });
      toast.success(resubmit ? 'Resubmitted for review.' : 'Submitted for review.');
      setOpen(false);
      setNotes('');
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't submit this project.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Send className="mr-1 h-3 w-3" />
        {resubmit ? 'Resubmit' : 'Submit project'}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="submit-notes">
        Notes <span className="text-xs font-normal text-slate-500">(optional)</span>
      </Label>
      <Textarea
        id="submit-notes"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What did you build / fix? Anything the reviewer should know?"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void submit()} loading={busy}>
          <Send className="mr-1 h-3 w-3" />
          {resubmit ? 'Resubmit' : 'Submit project'}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = d.getTime() - today.getTime();
    return Math.round(diff / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-1/3" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
