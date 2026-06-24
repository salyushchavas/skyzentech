'use client';

import { ChevronLeft, ChevronRight, Inbox, Paperclip, Star } from 'lucide-react';
import type { MailMessageSummary } from '@/lib/mail-client';
import { listDate } from '@/lib/mail-format';
import MailAvatar from './MailAvatar';

export default function MessageList({
  items,
  loading,
  selectedEntryId,
  onSelect,
  page,
  size,
  total,
  onPageChange,
}: {
  items: MailMessageSummary[];
  loading: boolean;
  selectedEntryId: string | null;
  onSelect: (entryId: string) => void;
  page: number;
  size: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min((page + 1) * size, total);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ul className="divide-y divide-slate-100">
            {Array.from({ length: 7 }).map((_, i) => (
              <li key={i} className="flex animate-pulse items-center gap-3 px-3 py-3">
                <span className="h-9 w-9 shrink-0 rounded-full bg-slate-200" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-1/3 rounded bg-slate-200" />
                  <span className="block h-3 w-2/3 rounded bg-slate-100" />
                </span>
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
            <Inbox className="mb-3 h-10 w-10 text-slate-300" strokeWidth={1.5} />
            <p className="text-sm font-medium text-slate-600">Nothing here</p>
            <p className="mt-1 text-xs text-slate-400">This folder has no messages.</p>
          </div>
        ) : (
          <ul>
            {items.map((m) => {
              const active = selectedEntryId === m.entryId;
              const sender = m.from?.displayName || m.from?.email || '(unknown)';
              const unread = !m.isRead;
              return (
                <li key={m.entryId}>
                  <button
                    type="button"
                    onClick={() => onSelect(m.entryId)}
                    aria-current={active ? 'true' : undefined}
                    className={
                      'relative flex w-full gap-3 border-b border-slate-100 px-3 py-3 text-left transition-colors ' +
                      (active ? 'bg-brand-50' : 'hover:bg-slate-50')
                    }
                  >
                    {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-brand-600" />}
                    <MailAvatar name={sender} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={
                            'truncate text-sm ' +
                            (unread ? 'font-semibold text-slate-900' : 'text-slate-700')
                          }
                        >
                          {sender}
                        </span>
                        <span
                          className={
                            'shrink-0 text-xs tabular-nums ' +
                            (unread ? 'font-semibold text-brand-700' : 'text-slate-400')
                          }
                        >
                          {listDate(m.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {m.isStarred && (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                        )}
                        {m.isImportant && (
                          <span
                            className="shrink-0 text-xs font-bold leading-none text-brand-700"
                            title="Important"
                          >
                            !
                          </span>
                        )}
                        <span
                          className={
                            'truncate text-sm ' +
                            (unread ? 'font-medium text-slate-700' : 'text-slate-500')
                          }
                        >
                          {m.subject || '(no subject)'}
                        </span>
                        {m.hasAttachments && (
                          <Paperclip className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        <span className="tabular-nums">
          {total === 0 ? '0' : `${from}–${to}`} of {total}
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={(page + 1) * size >= total}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </span>
      </div>
    </div>
  );
}
