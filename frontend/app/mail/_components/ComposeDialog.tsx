'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import {
  mailErrorMessage,
  saveDraft,
  sendDraft,
  sendMessage,
  updateDraft,
  type ComposePayload,
} from '@/lib/mail-client';
import { parseRecipients, type ComposeDraft } from '@/lib/mail-compose';

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
  const [busy, setBusy] = useState(false);

  // Reset from `initial` only on the closed->open transition, so a parent
  // re-render (which passes a fresh `initial` object) can't wipe edits mid-typing.
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

  async function onSaveDraft() {
    if (busy) return;
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
    if (busy) return;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            {draftEntryId ? 'Edit draft' : 'New message'}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 p-4">
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
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <span className="flex items-center gap-1 text-xs text-slate-400" title="Attachments coming soon">
            <Paperclip className="h-3 w-3" />
            Attachments coming soon
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onSaveDraft} loading={busy}>
              Save draft
            </Button>
            <Button leftIcon={<Send className="h-4 w-4" />} onClick={onSend} loading={busy}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
