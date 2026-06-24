'use client';

import { Archive, FileText, Inbox, PenSquare, Send, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { MailFolderCount } from '@/lib/mail-client';

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: Inbox },
  { key: 'STARRED', label: 'Starred', icon: Star },
  { key: 'SENT', label: 'Sent', icon: Send },
  { key: 'DRAFTS', label: 'Drafts', icon: FileText },
  { key: 'ARCHIVE', label: 'Archive', icon: Archive },
  { key: 'TRASH', label: 'Trash', icon: Trash2 },
];

export default function FolderRail({
  counts,
  selected,
  onSelect,
  onCompose,
}: {
  counts: MailFolderCount[];
  selected: string;
  onSelect: (folder: string) => void;
  onCompose: () => void;
}) {
  const byFolder = new Map(counts.map((c) => [c.folder, c]));
  return (
    <nav className="flex w-48 shrink-0 flex-col gap-2 border-r border-slate-200 p-3">
      <Button fullWidth leftIcon={<PenSquare className="h-4 w-4" />} onClick={onCompose}>
        Compose
      </Button>
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
              className={
                'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ' +
                (active
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-slate-700 hover:bg-slate-100')
              }
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {f.label}
              </span>
              {unread > 0 && (
                <span className="rounded-full bg-brand-700 px-1.5 text-xs font-semibold text-white">
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
