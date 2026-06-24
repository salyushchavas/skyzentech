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
    <nav className="hidden w-56 shrink-0 flex-col gap-4 border-r border-slate-200 bg-white p-3 md:flex">
      <Button
        fullWidth
        size="lg"
        leftIcon={<PenSquare className="h-4 w-4" />}
        onClick={onCompose}
        className="shadow-ds-sm"
      >
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
              aria-current={active ? 'page' : undefined}
              className={
                'group flex w-full items-center justify-between rounded-full py-2 pl-3 pr-2.5 text-sm transition-colors ' +
                (active
                  ? 'bg-brand-50 font-semibold text-brand-800'
                  : 'text-slate-700 hover:bg-slate-100')
              }
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={'h-[18px] w-[18px] ' + (active ? 'text-brand-700' : 'text-slate-500')}
                  strokeWidth={active ? 2.25 : 2}
                />
                {f.label}
              </span>
              {unread > 0 && (
                <span
                  className={
                    'min-w-[1.25rem] rounded-full px-1.5 text-center text-xs font-semibold tabular-nums ' +
                    (active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600')
                  }
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
