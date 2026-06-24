'use client';

import { Paperclip, Star } from 'lucide-react';
import type { MailMessageSummary } from '@/lib/mail-client';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

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
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No messages.</div>
        ) : (
          items.map((m) => {
            const active = selectedEntryId === m.entryId;
            return (
              <button
                key={m.entryId}
                type="button"
                onClick={() => onSelect(m.entryId)}
                className={
                  'block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 ' +
                  (active ? 'bg-brand-50' : '')
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      'truncate text-sm ' +
                      (m.isRead ? 'text-slate-700' : 'font-semibold text-slate-900')
                    }
                  >
                    {m.from?.displayName || m.from?.email || '(unknown)'}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{fmtDate(m.createdAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1">
                  {m.isStarred && (
                    <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                  {m.isImportant && (
                    <span className="shrink-0 text-xs font-bold text-brand-700" title="Important">
                      !
                    </span>
                  )}
                  <span
                    className={
                      'truncate text-sm ' +
                      (m.isRead ? 'text-slate-600' : 'font-medium text-slate-800')
                    }
                  >
                    {m.subject || '(no subject)'}
                  </span>
                  {m.hasAttachments && (
                    <Paperclip className="ml-auto h-3 w-3 shrink-0 text-slate-400" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        <span>{total} total</span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
            className="font-medium disabled:opacity-40"
          >
            Prev
          </button>
          <span>Page {page + 1}</span>
          <button
            type="button"
            disabled={(page + 1) * size >= total}
            onClick={() => onPageChange(page + 1)}
            className="font-medium disabled:opacity-40"
          >
            Next
          </button>
        </span>
      </div>
    </div>
  );
}
