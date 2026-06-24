'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import {
  deleteAttachment,
  mailErrorMessage,
  saveDraft,
  sendDraft,
  sendMessage,
  updateDraft,
  uploadAttachment,
  type ComposePayload,
  type MailAttachmentResponse,
} from '@/lib/mail-client';
import { parseRecipients, type ComposeDraft } from '@/lib/mail-compose';

const MAX_BYTES = 25 * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ComposeDialog({
  open,
  initial,
  onClose,
  onSent,
}: {
  open: boolean;
  initial: ComposeDraft;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [draftEntryId, setDraftEntryId] = useState<string | undefined>();
  const [inReplyTo, setInReplyTo] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<MailAttachmentResponse[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset from `initial` only on the closed->open transition (a parent re-render
  // passes a fresh `initial` object; guarding on the transition avoids wiping
  // edits / re-loading attachments mid-compose).
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setTo(initial.to);
      setCc(initial.cc);
      setBcc(initial.bcc);
      setSubject(initial.subject);
      setBody(initial.bodyText);
      setShowCc(!!(initial.cc || initial.bcc));
      setDraftEntryId(initial.draftEntryId);
      setInReplyTo(initial.inReplyTo);
      setAttachments(initial.attachments ?? []);
      setUploading(false);
      setProgress(0);
      setBusy(false);
    }
    prevOpen.current = open;
  }, [open, initial]);

  if (!open) return null;

  function buildPayload(): ComposePayload {
    return {
      to: parseRecipients(to),
      cc: parseRecipients(cc),
      bcc: parseRecipients(bcc),
      subject: subject || undefined,
      bodyText: body || undefined,
      inReplyTo,
    };
  }

  /** Attachments are draft-anchored, so ensure a draft row exists first. */
  async function ensureDraft(): Promise<string> {
    if (draftEntryId) return draftEntryId;
    const res = await saveDraft(buildPayload());
    setDraftEntryId(res.entryId);
    return res.entryId;
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error('File exceeds the 25 MB limit');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const draftId = await ensureDraft();
      const att = await uploadAttachment(draftId, file, setProgress);
      setAttachments((prev) => [...prev, att]);
    } catch (err) {
      toast.error(mailErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function onRemoveAttachment(id: string) {
    try {
      await deleteAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(mailErrorMessage(err, 'Could not remove attachment'));
    }
  }

  async function onSaveDraft() {
    if (busy || uploading) return;
    setBusy(true);
    try {
      const p = buildPayload();
      const res = draftEntryId ? await updateDraft(draftEntryId, p) : await saveDraft(p);
      setDraftEntryId(res.entryId);
      toast.success('Draft saved');
    } catch (e) {
      toast.error(mailErrorMessage(e, 'Could not save draft'));
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (busy || uploading) return;
    const count =
      parseRecipients(to).length + parseRecipients(cc).length + parseRecipients(bcc).length;
    if (count === 0) {
      toast.error('Add at least one recipient');
      return;
    }
    setBusy(true);
    try {
      const p = buildPayload();
      if (draftEntryId) {
        await sendDraft(draftEntryId, p);
      } else {
        await sendMessage(p);
      }
      toast.success('Message sent');
      onSent();
      onClose();
    } catch (e) {
      // S5 returns 422 for an unknown / cross-domain recipient — surface it.
      toast.error(mailErrorMessage(e, 'Could not send message'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-slate-900/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-2xl animate-modal-in flex-col overflow-hidden rounded-t-2xl bg-white shadow-ds-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {draftEntryId ? 'Edit draft' : 'New message'}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (comma-separated)" />
            </div>
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="shrink-0 text-xs font-medium text-brand-700 hover:underline"
              >
                Cc/Bcc
              </button>
            )}
          </div>
          {showCc && <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Cc" />}
          {showCc && <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="Bcc" />}
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            rows={12}
          />
        </div>
        <div className="border-t border-slate-200 px-5 py-4">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                >
                  <Paperclip className="h-3 w-3" />
                  {a.filename}
                  <span className="text-slate-400">({fmtSize(a.sizeBytes)})</span>
                  <button
                    type="button"
                    onClick={() => void onRemoveAttachment(a.id)}
                    className="ml-1 text-slate-400 hover:text-red-600"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {uploading && (
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-700 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Paperclip className="h-4 w-4" />}
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? `Uploading… ${progress}%` : 'Attach'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onSaveDraft} loading={busy} disabled={uploading}>
                Save draft
              </Button>
              <Button leftIcon={<Send className="h-4 w-4" />} onClick={onSend} loading={busy} disabled={uploading}>
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
