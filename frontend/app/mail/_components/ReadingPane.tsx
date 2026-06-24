'use client';

import {
  AlertCircle,
  CornerUpLeft,
  CornerUpRight,
  Download,
  Forward,
  Mail,
  MailOpen,
  Paperclip,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import {
  downloadAttachment,
  mailErrorMessage,
  type MailMessageDetail,
  type MailParticipant,
} from '@/lib/mail-client';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MOVE_TARGETS = ['INBOX', 'ARCHIVE', 'SENT', 'DRAFTS', 'TRASH'];

function fmtFull(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
}

function one(p?: MailParticipant | null): string {
  if (!p) return '(unknown)';
  return p.displayName ? `${p.displayName} <${p.email}>` : p.email;
}

function names(list?: MailParticipant[] | null): string {
  return (list ?? []).map(one).join(', ');
}

export default function ReadingPane({
  detail,
  loading,
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
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onEditDraft: () => void;
  onFlag: (flags: { isRead?: boolean; isStarred?: boolean; isImportant?: boolean }) => void;
  onMove: (folder: string) => void;
  onDelete: () => void;
}) {
  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading…</div>;
  }
  if (!detail) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        Select a message to read
      </div>
    );
  }
  const isDraft = detail.folder === 'DRAFTS';
  // Body is rendered as ESCAPED PLAIN TEXT (React escapes string children); we
  // never dangerouslySetInnerHTML server HTML. A sanitized HTML view can arrive
  // with the attachments/rules phase once a sanitizer dep is added.
  const body = detail.bodyText ?? detail.bodyHtml ?? '';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 p-2">
        {isDraft ? (
          <Button size="sm" variant="secondary" leftIcon={<Pencil className="h-4 w-4" />} onClick={onEditDraft}>
            Edit draft
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" leftIcon={<CornerUpLeft className="h-4 w-4" />} onClick={onReply}>
              Reply
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<CornerUpRight className="h-4 w-4" />} onClick={onReplyAll}>
              Reply all
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<Forward className="h-4 w-4" />} onClick={onForward}>
              Forward
            </Button>
          </>
        )}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <button
          type="button"
          title={detail.isStarred ? 'Unstar' : 'Star'}
          onClick={() => onFlag({ isStarred: !detail.isStarred })}
          className="rounded p-1.5 hover:bg-slate-100"
        >
          <Star className={'h-4 w-4 ' + (detail.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-500')} />
        </button>
        <button
          type="button"
          title={detail.isImportant ? 'Mark not important' : 'Mark important'}
          onClick={() => onFlag({ isImportant: !detail.isImportant })}
          className="rounded p-1.5 hover:bg-slate-100"
        >
          <AlertCircle className={'h-4 w-4 ' + (detail.isImportant ? 'text-brand-700' : 'text-slate-500')} />
        </button>
        <button
          type="button"
          title={detail.isRead ? 'Mark unread' : 'Mark read'}
          onClick={() => onFlag({ isRead: !detail.isRead })}
          className="rounded p-1.5 hover:bg-slate-100"
        >
          {detail.isRead ? (
            <Mail className="h-4 w-4 text-slate-500" />
          ) : (
            <MailOpen className="h-4 w-4 text-slate-500" />
          )}
        </button>
        <select
          aria-label="Move to folder"
          value=""
          onChange={(e) => {
            if (e.target.value) onMove(e.target.value);
          }}
          className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Move to…</option>
          {MOVE_TARGETS.filter((f) => f !== detail.folder).map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <button
          type="button"
          title={detail.folder === 'TRASH' ? 'Delete permanently' : 'Move to Trash'}
          onClick={onDelete}
          className="rounded p-1.5 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">{detail.subject || '(no subject)'}</h2>
        <div className="mt-1 text-sm text-slate-600">
          From: <span className="font-medium text-slate-800">{one(detail.from)}</span>
        </div>
        {detail.to && detail.to.length > 0 && (
          <div className="text-sm text-slate-600">To: {names(detail.to)}</div>
        )}
        {detail.cc && detail.cc.length > 0 && (
          <div className="text-sm text-slate-600">Cc: {names(detail.cc)}</div>
        )}
        {detail.bcc && detail.bcc.length > 0 && (
          <div className="text-sm text-slate-600">Bcc: {names(detail.bcc)}</div>
        )}
        <div className="mt-1 text-xs text-slate-400">{fmtFull(detail.createdAt)}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="whitespace-pre-wrap break-words text-sm text-slate-800">{body}</div>
        {detail.attachments && detail.attachments.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Attachments
            </div>
            {detail.attachments.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  void downloadAttachment(a).catch((e) =>
                    toast.error(mailErrorMessage(e, 'Download failed')),
                  )
                }
                className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 truncate">{a.filename}</span>
                <span className="text-xs text-slate-400">{fmtSize(a.sizeBytes)}</span>
                <Download className="h-4 w-4 shrink-0 text-brand-700" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
