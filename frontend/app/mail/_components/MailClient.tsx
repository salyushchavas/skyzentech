'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, Search } from 'lucide-react';
import { ensureNotificationPermission, notifyNewMail, openMailEventStream } from '@/lib/mail-events';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { useMailAuth } from '../_providers/MailAuthProvider';
import ComposeDialog from './ComposeDialog';
import FolderRail from './FolderRail';
import MessageList from './MessageList';
import ReadingPane from './ReadingPane';
import {
  buildForward,
  buildFromDraft,
  buildReply,
  buildReplyAll,
  emptyDraft,
  type ComposeDraft,
} from '@/lib/mail-compose';
import {
  deleteMessage,
  folderCounts,
  getMessage,
  listFolder,
  listStarred,
  mailErrorMessage,
  moveMessage,
  searchMessages,
  setMessageFlags,
  type MailFolderCount,
  type MailMessageDetail,
  type MailMessageSummary,
} from '@/lib/mail-client';

const PAGE_SIZE = 25;

export default function MailClient() {
  const { account } = useMailAuth();
  const selfEmail = account?.email ?? '';

  const [folder, setFolder] = useState('INBOX');
  const [counts, setCounts] = useState<MailFolderCount[]>([]);
  const [items, setItems] = useState<MailMessageSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [compose, setCompose] = useState<{ open: boolean; initial: ComposeDraft }>({
    open: false,
    initial: emptyDraft(),
  });
  const [reloadKey, setReloadKey] = useState(0);

  const searchActive = submittedQuery.trim().length > 0;

  const refreshCounts = useCallback(() => {
    folderCounts().then(setCounts).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, reloadKey]);

  // Latest folder / search state for the long-lived SSE handler (which is opened
  // once and must not re-subscribe on every folder change).
  const folderRef = useRef(folder);
  const searchActiveRef = useRef(searchActive);
  useEffect(() => {
    folderRef.current = folder;
    searchActiveRef.current = searchActive;
  }, [folder, searchActive]);

  // Real-time new-mail stream: resync counts on (re)connect; on a NEW_MAIL push
  // refresh counts, reload the list if it landed in the folder being viewed, and
  // surface a browser notification for INBOX arrivals while the tab is hidden.
  useEffect(() => {
    ensureNotificationPermission();
    const close = openMailEventStream({
      onOpen: () => refreshCounts(),
      onEvent: (ev) => {
        if (ev.type !== 'NEW_MAIL') return;
        refreshCounts();
        if (!searchActiveRef.current && ev.folder === folderRef.current) reloadList();
        notifyNewMail(ev.folder);
      },
    });
    return close;
    // Open exactly once; handlers read live state via refs / stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCounts]);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    (async () => {
      try {
        const res = submittedQuery.trim()
          ? await searchMessages(submittedQuery.trim(), page, PAGE_SIZE)
          : folder === 'STARRED'
            ? await listStarred(page, PAGE_SIZE)
            : await listFolder(folder, page, PAGE_SIZE);
        if (!cancelled) {
          setItems(res.items);
          setTotal(res.total);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(mailErrorMessage(e, 'Failed to load messages'));
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folder, page, submittedQuery, reloadKey]);

  function reloadList() {
    setReloadKey((k) => k + 1);
  }

  function selectFolder(f: string) {
    setFolder(f);
    setSubmittedQuery('');
    setSearch('');
    setPage(0);
    setSelectedEntryId(null);
    setDetail(null);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedQuery(search);
    setPage(0);
    setSelectedEntryId(null);
    setDetail(null);
  }

  async function openMessage(entryId: string) {
    setSelectedEntryId(entryId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await getMessage(entryId);
      if (!d.isRead) {
        // Mark read on open — optimistic in BOTH detail + list; revert both if
        // the flag call fails so the UI never diverges from the server.
        setDetail({ ...d, isRead: true });
        setItems((prev) => prev.map((m) => (m.entryId === entryId ? { ...m, isRead: true } : m)));
        setMessageFlags(entryId, { isRead: true })
          .then(() => refreshCounts())
          .catch(() => {
            setDetail((cur) => (cur && cur.entryId === entryId ? { ...cur, isRead: false } : cur));
            setItems((prev) =>
              prev.map((m) => (m.entryId === entryId ? { ...m, isRead: false } : m)),
            );
          });
      } else {
        setDetail(d);
      }
    } catch (e) {
      toast.error(mailErrorMessage(e, 'Failed to open message'));
    } finally {
      setDetailLoading(false);
    }
  }

  function openCompose(initial: ComposeDraft) {
    setCompose({ open: true, initial });
  }

  async function onFlag(flags: { isRead?: boolean; isStarred?: boolean; isImportant?: boolean }) {
    if (!detail) return;
    try {
      const d = await setMessageFlags(detail.entryId, flags);
      setDetail(d);
      reloadList();
      refreshCounts();
    } catch (e) {
      toast.error(mailErrorMessage(e));
    }
  }

  async function onMove(targetFolder: string) {
    if (!detail) return;
    try {
      await moveMessage(detail.entryId, targetFolder);
      toast.success(`Moved to ${targetFolder}`);
      setDetail(null);
      setSelectedEntryId(null);
      reloadList();
      refreshCounts();
    } catch (e) {
      toast.error(mailErrorMessage(e));
    }
  }

  async function onDelete() {
    if (!detail) return;
    try {
      if (detail.folder === 'TRASH') {
        await deleteMessage(detail.entryId);
        toast.success('Deleted');
      } else {
        await moveMessage(detail.entryId, 'TRASH');
        toast.success('Moved to Trash');
      }
      setDetail(null);
      setSelectedEntryId(null);
      reloadList();
      refreshCounts();
    } catch (e) {
      toast.error(mailErrorMessage(e));
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-ds-md">
      {/* Folder rail — desktop/tablet only (graceful narrow degradation). */}
      <FolderRail
        counts={counts}
        selected={searchActive ? '' : folder}
        onSelect={selectFolder}
        onCompose={() => openCompose(emptyDraft())}
      />

      {/* Message list — full width on narrow, fixed column on md+. Hidden on
          narrow once a message is open so the reading pane takes over. */}
      <div
        className={cn(
          'w-full flex-col border-r border-slate-200 md:w-96 md:shrink-0',
          detail || detailLoading ? 'hidden md:flex' : 'flex',
        )}
      >
        <form onSubmit={onSearchSubmit} className="border-b border-slate-200 bg-slate-50/60 p-2.5">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject or people…"
            leftIcon={<Search className="h-4 w-4" />}
          />
        </form>
        <div className="flex-1 overflow-hidden">
          <MessageList
            items={items}
            loading={listLoading}
            selectedEntryId={selectedEntryId}
            onSelect={openMessage}
            page={page}
            size={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* Reading pane — full view on narrow when a message is open. */}
      <div
        className={cn(
          'flex-1 flex-col',
          detail || detailLoading ? 'flex' : 'hidden md:flex',
        )}
      >
        {(detail || detailLoading) && (
          <button
            type="button"
            onClick={() => {
              setSelectedEntryId(null);
              setDetail(null);
            }}
            className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:text-brand-700 md:hidden"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        <ReadingPane
          detail={detail}
          loading={detailLoading}
          onReply={() => detail && openCompose(buildReply(detail))}
          onReplyAll={() => detail && openCompose(buildReplyAll(detail, selfEmail))}
          onForward={() => detail && openCompose(buildForward(detail))}
          onEditDraft={() => detail && openCompose(buildFromDraft(detail))}
          onFlag={onFlag}
          onMove={onMove}
          onDelete={onDelete}
        />
      </div>

      <ComposeDialog
        open={compose.open}
        initial={compose.initial}
        onClose={() => setCompose((c) => ({ ...c, open: false }))}
        onSent={() => {
          reloadList();
          refreshCounts();
        }}
      />
    </div>
  );
}
