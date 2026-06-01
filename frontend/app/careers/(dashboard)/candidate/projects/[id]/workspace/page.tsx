'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  AlertCircle,
  CheckCircle2,
  FilePlus,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import type {
  ProjectStatus,
  WorkspaceFile,
  WorkspaceSubmission,
} from '@/types';

/**
 * Monaco only runs in the browser. Dynamically-imported with ssr:false so
 * the Next.js server bundle stays lean and the editor lazy-loads on first
 * paint.
 */
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      Loading editor…
    </div>
  ),
});

const AUTO_SAVE_MS = 1500;
const MAX_PATH_LENGTH = 512;

export default function CandidateWorkspacePage() {
  return (
    <ProtectedRoute requiredRoles={['INTERN']}>
      <DashboardLayout title="Workspace">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

interface ProjectLite {
  id: string;
  title: string;
  status: ProjectStatus;
}

function Body() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id;

  const [project, setProject] = useState<ProjectLite | null>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [openContent, setOpenContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [submissions, setSubmissions] = useState<WorkspaceSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-save bookkeeping.
  const dirty = openContent !== savedContent;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const editable = useMemo(() => {
    const s = project?.status;
    return s === 'IN_PROGRESS' || s === 'NOT_STARTED';
  }, [project?.status]);

  const latestSubmission = submissions[0] ?? null;
  const returnedBanner =
    project?.status === 'IN_PROGRESS'
    && latestSubmission?.reviewOutcome === 'RETURNED'
      ? latestSubmission
      : null;

  // ── Loaders ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    try {
      const [proj, list, subs] = await Promise.all([
        api.get<ProjectLite>(`/api/v1/projects/${projectId}`).catch(() => null),
        api.get<WorkspaceFile[]>(
          `/api/v1/projects/${projectId}/workspace/files`,
        ),
        api.get<WorkspaceSubmission[]>(
          `/api/v1/projects/${projectId}/submissions`,
        ).catch(() => ({ data: [] as WorkspaceSubmission[] })),
      ]);
      // Some legacy backend builds don't expose GET /projects/{id}. Fall
      // back to listing the intern's projects and finding the one by id.
      if (proj?.data) {
        setProject(proj.data);
      } else {
        const me = await api.get<ProjectLite[]>('/api/v1/projects/me');
        const match = me.data.find((p) => p.id === projectId);
        setProject(match ?? null);
      }
      setFiles(list.data);
      setSubmissions(subs.data ?? []);
      if (list.data.length > 0 && openPath == null) {
        await openFile(list.data[0].path);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't load the workspace.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openFile = useCallback(
    async (path: string) => {
      if (!projectId) return;
      try {
        const res = await api.get<WorkspaceFile>(
          `/api/v1/projects/${projectId}/workspace/files/${encodeFilePath(path)}`,
        );
        setOpenPath(path);
        setOpenContent(res.data.content ?? '');
        setSavedContent(res.data.content ?? '');
      } catch (err: any) {
        toast.error(err?.response?.data?.error ?? "Couldn't open the file.");
      }
    },
    [projectId],
  );

  // ── Auto-save ──────────────────────────────────────────────────────────

  const saveNow = useCallback(async () => {
    if (!projectId || !openPath || !editable || savingRef.current) return;
    if (openContent === savedContent) return;
    savingRef.current = true;
    try {
      await api.put(
        `/api/v1/projects/${projectId}/workspace/files/${encodeFilePath(openPath)}`,
        { content: openContent },
      );
      setSavedContent(openContent);
      // Refresh metadata for the file row (size, lastModifiedAt).
      setFiles((curr) =>
        curr.map((f) =>
          f.path === openPath
            ? { ...f, sizeBytes: new TextEncoder().encode(openContent).length }
            : f,
        ),
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't save the file.");
    } finally {
      savingRef.current = false;
    }
  }, [projectId, openPath, openContent, savedContent, editable]);

  useEffect(() => {
    if (!dirty || !editable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveNow();
    }, AUTO_SAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [openContent, dirty, editable, saveNow]);

  // ── File-tree commands ────────────────────────────────────────────────

  async function onNewFile() {
    if (!projectId || !editable) return;
    const path = window.prompt('New file path (e.g. src/main.py):');
    if (!path) return;
    const trimmed = path.trim();
    if (!trimmed || trimmed.length > MAX_PATH_LENGTH) return;
    try {
      await api.put(
        `/api/v1/projects/${projectId}/workspace/files/${encodeFilePath(trimmed)}`,
        { content: '' },
      );
      toast.success('File created.');
      await load();
      await openFile(trimmed);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't create the file.");
    }
  }

  async function onDelete(path: string) {
    if (!projectId || !editable) return;
    if (!window.confirm(`Delete ${path}? This can't be undone.`)) return;
    try {
      await api.delete(
        `/api/v1/projects/${projectId}/workspace/files/${encodeFilePath(path)}`,
      );
      if (openPath === path) {
        setOpenPath(null);
        setOpenContent('');
        setSavedContent('');
      }
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't delete the file.");
    }
  }

  async function onRename(fromPath: string) {
    if (!projectId || !editable) return;
    const toPath = window.prompt('Rename to:', fromPath);
    if (!toPath || toPath === fromPath) return;
    try {
      await api.post(
        `/api/v1/projects/${projectId}/workspace/files/rename`,
        { fromPath, toPath: toPath.trim() },
      );
      if (openPath === fromPath) setOpenPath(toPath.trim());
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't rename.");
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────

  const submitDisabled =
    !editable || files.length === 0 || dirty || submitting;

  async function submitWorkspace() {
    if (!projectId || submitDisabled) return;
    setSubmitting(true);
    try {
      // Flush any pending auto-save before snapshotting.
      if (dirty) await saveNow();
      const res = await api.post<WorkspaceSubmission>(
        `/api/v1/projects/${projectId}/workspace/submit`,
      );
      toast.success(`Submission #${res.data.submissionNumber} created.`);
      setConfirmSubmit(false);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Couldn't submit.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!project)
    return (
      <div className="rounded border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
        Project not found, or you don&apos;t have access to it.
      </div>
    );

  return (
    <section className="flex h-[calc(100vh-180px)] flex-col">
      {/* Top bar */}
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.push('/careers/candidate/projects')}
            className="mb-1 text-xs text-gray-500 hover:text-gray-700"
          >
            ← Back to projects
          </button>
          <h1 className="truncate text-xl font-semibold text-gray-900">
            {project.title}
          </h1>
          <StatusBadge status={project.status} />
        </div>
        <button
          type="button"
          onClick={() => setConfirmSubmit(true)}
          disabled={submitDisabled}
          title={
            !editable
              ? 'Workspace is locked'
              : files.length === 0
                ? 'Add at least one file'
                : dirty
                  ? 'Save changes first'
                  : 'Submit for review'
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          Submit for review
        </button>
      </header>

      {returnedBanner && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <div>
            <p className="font-medium">
              Returned for revisions (submission #{returnedBanner.submissionNumber}).
            </p>
            {returnedBanner.reviewReason && (
              <p className="mt-1 whitespace-pre-wrap text-orange-800">
                {returnedBanner.reviewReason}
              </p>
            )}
          </div>
        </div>
      )}

      {!editable && project.status !== 'IN_PROGRESS' && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <p>
            {lockedMessage(project.status)} Files are read-only here.
          </p>
        </div>
      )}

      {/* Three-pane layout */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* File tree */}
        <aside className="flex w-64 shrink-0 flex-col rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Files ({files.length})
            </span>
            <button
              type="button"
              onClick={onNewFile}
              disabled={!editable}
              className="inline-flex items-center gap-1 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
              title="New file"
            >
              <FilePlus className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto py-1 text-sm">
            {files.length === 0 ? (
              <li className="px-3 py-3 text-xs italic text-gray-400">
                No files yet. Add one to get started.
              </li>
            ) : (
              files.map((f) => (
                <li key={f.id} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => void openFile(f.path)}
                    className={
                      'flex-1 truncate px-3 py-1.5 text-left ' +
                      (f.path === openPath
                        ? 'bg-accent/10 font-medium text-accent-dark'
                        : 'text-gray-700 hover:bg-gray-50')
                    }
                    title={f.path}
                  >
                    {f.path}
                  </button>
                  {editable && (
                    <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => void onRename(f.path)}
                        className="px-1 text-gray-400 hover:text-gray-700"
                        title="Rename"
                      >
                        <RotateCcw className="h-3 w-3" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(f.path)}
                        className="px-2 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </aside>

        {/* Editor */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
          {openPath ? (
            <>
              <div className="flex items-center justify-between border-b border-gray-200 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className={
                      'h-2 w-2 rounded-full ' +
                      (dirty ? 'bg-amber-500' : 'bg-emerald-500')
                    }
                    title={dirty ? 'Unsaved changes' : 'Saved'}
                  />
                  <span className="font-medium text-gray-800">{openPath}</span>
                  {!editable && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                      Read only
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <MonacoEditor
                  height="100%"
                  language={languageForPath(openPath)}
                  value={openContent}
                  onChange={(v) => setOpenContent(v ?? '')}
                  options={{
                    readOnly: !editable,
                    minimap: { enabled: false },
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                  theme="vs-light"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              Select a file to start editing.
            </div>
          )}
        </div>
      </div>

      {/* Submit-confirmation modal */}
      {confirmSubmit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Submit for review?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This snapshots all {files.length} file{files.length === 1 ? '' : 's'}{' '}
              in your workspace right now. You can keep editing after, but your
              evaluator reviews this exact snapshot.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                disabled={submitting}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitWorkspace()}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectStatus }) {
  const palette: Record<ProjectStatus, string> = {
    NOT_STARTED: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-sky-100 text-sky-800',
    SUBMITTED: 'bg-amber-100 text-amber-800',
    RETURNED: 'bg-orange-100 text-orange-800',
    TECH_APPROVED: 'bg-indigo-100 text-indigo-800',
    PENDING_VIVA: 'bg-violet-100 text-violet-800',
    COMPLETED: 'bg-emerald-100 text-emerald-800',
  };
  const label: Record<ProjectStatus, string> = {
    NOT_STARTED: 'Not started',
    IN_PROGRESS: 'In progress',
    SUBMITTED: 'Awaiting review',
    RETURNED: 'Returned',
    TECH_APPROVED: 'Tech approved',
    PENDING_VIVA: 'Pending viva',
    COMPLETED: 'Completed',
  };
  return (
    <span
      className={
        'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
        palette[status]
      }
    >
      {label[status]}
    </span>
  );
}

function lockedMessage(s: ProjectStatus): string {
  if (s === 'SUBMITTED') return 'Submitted for review — waiting on the evaluator.';
  if (s === 'TECH_APPROVED') return 'Technically approved — Reporting Manager next.';
  if (s === 'PENDING_VIVA') return 'Pending viva.';
  if (s === 'COMPLETED') return 'Project completed.';
  return 'Workspace is locked.';
}

function encodeFilePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function languageForPath(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-1/3 animate-pulse rounded bg-gray-100" />
      <div className="h-[60vh] animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
