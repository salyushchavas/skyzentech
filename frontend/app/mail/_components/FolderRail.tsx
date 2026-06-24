'use client';

import { useState } from 'react';
import {
  Archive,
  Check,
  FileText,
  Folder,
  FolderPlus,
  Inbox,
  PenSquare,
  Pencil,
  Send,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { MailCustomFolder, MailFolderCount } from '@/lib/mail-client';

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: Inbox },
  { key: 'STARRED', label: 'Starred', icon: Star },
  { key: 'SENT', label: 'Sent', icon: Send },
  { key: 'DRAFTS', label: 'Drafts', icon: FileText },
  { key: 'ARCHIVE', label: 'Archive', icon: Archive },
  { key: 'TRASH', label: 'Trash', icon: Trash2 },
];

const INPUT_CLASS =
  'min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500';

function Badge({ n, active }: { n: number; active: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        'min-w-[1.25rem] rounded-full px-1.5 text-center text-xs font-semibold tabular-nums',
        active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

export default function FolderRail({
  counts,
  selected,
  onSelect,
  onCompose,
  customFolders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  className,
}: {
  counts: MailFolderCount[];
  selected: string;
  onSelect: (folder: string) => void;
  onCompose: () => void;
  customFolders: MailCustomFolder[];
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (folder: MailCustomFolder) => void;
  className?: string;
}) {
  const byFolder = new Map(counts.map((c) => [c.folder, c]));
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  function submitNew() {
    const n = newName.trim();
    if (n) onCreateFolder(n);
    setNewName('');
    setAdding(false);
  }

  function submitRename(id: string) {
    const n = renameName.trim();
    if (n) onRenameFolder(id, n);
    setRenamingId(null);
    setRenameName('');
  }

  return (
    <nav
      className={cn(
        'w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-3',
        className,
      )}
    >
      <Button fullWidth size="lg" leftIcon={<PenSquare className="h-4 w-4" />} onClick={onCompose} className="shadow-ds-sm">
        Compose
      </Button>

      {/* System folders */}
      <div className="space-y-0.5">
        {FOLDERS.map((f) => {
          const Icon = f.icon;
          const active = selected === f.key;
          const unread = f.key === 'STARRED' ? 0 : byFolder.get(f.key)?.unread ?? 0;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onSelect(f.key)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex w-full items-center justify-between rounded-full py-2 pl-3 pr-2.5 text-sm transition-colors',
                active ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-700 hover:bg-slate-100',
              )}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={cn('h-[18px] w-[18px]', active ? 'text-brand-700' : 'text-slate-500')}
                  strokeWidth={active ? 2.25 : 2}
                />
                {f.label}
              </span>
              <Badge n={unread} active={active} />
            </button>
          );
        })}
      </div>

      {/* Custom folders */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Folders</span>
          <button
            type="button"
            title="New folder"
            onClick={() => {
              setAdding(true);
              setRenamingId(null);
            }}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>

        {adding && (
          <div className="flex items-center gap-1 px-1 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNew();
                if (e.key === 'Escape') {
                  setAdding(false);
                  setNewName('');
                }
              }}
              placeholder="Folder name"
              className={INPUT_CLASS}
            />
            <button type="button" onClick={submitNew} title="Create" className="rounded p-1 text-brand-700 hover:bg-brand-50">
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewName('');
              }}
              title="Cancel"
              className="rounded p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {customFolders.map((f) => {
          const active = selected === f.id;
          if (renamingId === f.id) {
            return (
              <div key={f.id} className="flex items-center gap-1 px-1 py-1">
                <input
                  autoFocus
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(f.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => submitRename(f.id)}
                  title="Save"
                  className="rounded p-1 text-brand-700 hover:bg-brand-50"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  title="Cancel"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          }
          return (
            <div
              key={f.id}
              className={cn(
                'group flex items-center justify-between rounded-full py-2 pl-3 pr-1.5 text-sm transition-colors',
                active ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-700 hover:bg-slate-100',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(f.id)}
                aria-current={active ? 'page' : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Folder
                  className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-brand-700' : 'text-slate-500')}
                  strokeWidth={active ? 2.25 : 2}
                />
                <span className="truncate">{f.name}</span>
              </button>
              <span className="flex shrink-0 items-center gap-0.5">
                <span className="group-hover:hidden">
                  <Badge n={f.unread} active={active} />
                </span>
                <button
                  type="button"
                  title="Rename"
                  onClick={() => {
                    setRenamingId(f.id);
                    setRenameName(f.name);
                    setAdding(false);
                  }}
                  className="hidden rounded p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 group-hover:inline-flex"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete folder"
                  onClick={() => onDeleteFolder(f)}
                  className="hidden rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover:inline-flex"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          );
        })}

        {customFolders.length === 0 && !adding && (
          <p className="px-3 py-1 text-xs text-slate-400">No folders yet</p>
        )}
      </div>
    </nav>
  );
}
