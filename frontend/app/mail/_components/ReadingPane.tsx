'use client';

import {
  AlertCircle,
  Download,
  Forward,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  Pencil,
  Reply,
  ReplyAll,
  Star,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/cn';
import {
  downloadAttachment,
  mailErrorMessage,
  type MailCustomFolder,
  type MailMessageDetail,
  type MailParticipant,
} from '@/lib/mail-client';
import { fullDateTime } from '@/lib/mail-format';
import MailAvatar from './MailAvatar';

const MOVE_TARGETS = ['INBOX', 'ARCHIVE', 'SENT', 'DRAFTS', 'TRASH'];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function one(p?: MailParticipant | null): string {
  if (!p) return '(unknown)';
  return p.displayName ? `${p.displayName} <${p.email}>` : p.email;
}

function names(list?: MailParticipant[] | null): string {
  return (list ?? []).map(one).join(', ');
}

/** Quiet icon button for the action toolbar. */
function ToolBtn({
  title,
  onClick,
  active,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'rounded-full p-2 transition-colors',
        danger
          ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
          : active
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
      )}
    >
      {children}
    </button>
  );
}

export default function ReadingPane({
  detail,
  loading,
  customFolders,
  onReply,
  onReplyAll,
  onForward,
  onEditDraft,
  onFlag,
  onMove,
  onDelete,
}: {
  detail: MailMessageDetail | null;
  loading: boolean;
  customFolders: MailCustomFolder[];
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onEditDraft: () => void;
  onFlag: (flags: { isRead?: boolean; isStarred?: boolean; isImportant?: boolean }) => void;
  onMove: (target: string) => void;
  onDelete: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white text-sm text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 text-center">
        <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
          <Mail className="h-8 w-8 text-brand-300" strokeWidth={1.5} />
        </span>
        <p className="text-base font-medium text-slate-700">Select a message to read</p>
        <p className="mt-1 max-w-xs text-sm text-slate-400">
          Choose a conversation from the list and it opens here.
        </p>
      </div>
    );
  }

  const isDraft = detail.folder === 'DRAFTS';
  const senderName = detail.from?.displayName || detail.from?.email || '(unknown)';
  // Body is rendered as ESCAPED PLAIN TEXT (React escapes string children); we
  // never dangerouslySetInnerHTML server HTML. A sanitized HTML view can arrive
  // later once a sanitizer dep is added.
  const body = detail.bodyText ?? detail.bodyHtml ?? '';

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Action toolbar */}
      <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2">
        {isDraft ? (
          <button
            type="button"
            onClick={onEditDraft}
            className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
          >
            <Pencil className="h-4 w-4" />
            Edit draft
          </button>
        ) : (
          <>
            <ToolBtn title="Reply" onClick={onReply}>
              <Reply className="h-[18px] w-[18px]" />
            </ToolBtn>
            <ToolBtn title="Reply all" onClick={onReplyAll}>
              <ReplyAll className="h-[18px] w-[18px]" />
            </ToolBtn>
            <ToolBtn title="Forward" onClick={onForward}>
              <Forward className="h-[18px] w-[18px]" />
            </ToolBtn>
          </>
        )}

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <ToolBtn
          title={detail.isStarred ? 'Unstar' : 'Star'}
          active={detail.isStarred}
          onClick={() => onFlag({ isStarred: !detail.isStarred })}
        >
          <Star
            className={cn('h-[18px] w-[18px]', detail.isStarred && 'fill-amber-400 text-amber-400')}
          />
        </ToolBtn>
        <ToolBtn
          title={detail.isImportant ? 'Mark not important' : 'Mark important'}
          active={detail.isImportant}
          onClick={() => onFlag({ isImportant: !detail.isImportant })}
        >
          <AlertCircle className="h-[18px] w-[18px]" />
        </ToolBtn>
        <ToolBtn
          title={detail.isRead ? 'Mark unread' : 'Mark read'}
          onClick={() => onFlag({ isRead: !detail.isRead })}
        >
          {detail.isRead ? (
            <Mail className="h-[18px] w-[18px]" />
          ) : (
            <MailOpen className="h-[18px] w-[18px]" />
          )}
        </ToolBtn>

        <span className="ml-auto flex items-center gap-1">
          <select
            aria-label="Move to folder"
            value=""
            onChange={(e) => {
              if (e.target.value) onMove(e.target.value);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-400 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Move to…</option>
            <optgroup label="System">
              {MOVE_TARGETS.filter((f) => (detail.customFolderId ? true : f !== detail.folder)).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </optgroup>
            {customFolders.length > 0 && (
              <optgroup label="Folders">
                {customFolders
                  .filter((c) => c.id !== detail.customFolderId)
                  .map((c) => (
                    <option key={c.id} value={`custom:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
          <ToolBtn
            title={detail.folder === 'TRASH' ? 'Delete permanently' : 'Move to Trash'}
            danger
            onClick={onDelete}
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </ToolBtn>
        </span>
      </div>

      {/* Message header */}
      <div className="border-b border-slate-200 px-6 py-5">
        <h1 className="text-xl font-semibold leading-snug text-slate-900">
          {detail.subject || '(no subject)'}
        </h1>
        <div className="mt-4 flex items-start gap-3">
          <MailAvatar name={senderName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-semibold text-slate-900">
                {detail.from?.displayName || detail.from?.email || '(unknown)'}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{fullDateTime(detail.createdAt)}</span>
            </div>
            {detail.from?.email && detail.from?.displayName && (
              <div className="truncate text-sm text-slate-500">{detail.from.email}</div>
            )}
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
              {detail.to && detail.to.length > 0 && (
                <div className="truncate">
                  <span className="text-slate-400">To:</span> {names(detail.to)}
                </div>
              )}
              {detail.cc && detail.cc.length > 0 && (
                <div className="truncate">
                  <span className="text-slate-400">Cc:</span> {names(detail.cc)}
                </div>
              )}
              {detail.bcc && detail.bcc.length > 0 && (
                <div className="truncate">
                  <span className="text-slate-400">Bcc:</span> {names(detail.bcc)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body + attachments */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
          {body}
        </div>
        {detail.attachments && detail.attachments.length > 0 && (
          <div className="mx-auto mt-6 max-w-3xl">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Paperclip className="h-3.5 w-3.5" />
              {detail.attachments.length} attachment{detail.attachments.length > 1 ? 's' : ''}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {detail.attachments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    void downloadAttachment(a).catch((e) =>
                      toast.error(mailErrorMessage(e, 'Download failed')),
                    )
                  }
                  className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-400 ring-1 ring-slate-200 group-hover:text-brand-600">
                    <Paperclip className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-700">
                      {a.filename}
                    </span>
                    <span className="block text-xs text-slate-400">{fmtSize(a.sizeBytes)}</span>
                  </span>
                  <Download className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-brand-700" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
