'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, Menu, Search } from 'lucide-react';
import { ensureNotificationPermission, notifyNewMail, openMailEventStream } from '@/lib/mail-events';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import ConfirmDialog from '@/components/ConfirmDialog';
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
  createCustomFolder,
  deleteCustomFolder,
  deleteMessage,
  folderCounts,
  getMessage,
  listCustomFolderMessages,
  listCustomFolders,
  listFolder,
  listStarred,
  mailErrorMessage,
  moveMessage,
  moveMessageToCustomFolder,
  renameCustomFolder,
  searchMessages,
  setMessageFlags,
  type MailCustomFolder,
  type MailFolderCount,
  type MailMessageDetail,
  type MailMessageSummary,
} from '@/lib/mail-client';

const PAGE_SIZE = 25;
const SYSTEM_FOLDERS = new Set(['INBOX', 'STARRED', 'SENT', 'DRAFTS', 'ARCHIVE', 'TRASH']);

export default function MailClient() {
  const { account } = useMailAuth();
  const selfEmail = account?.email ?? '';

  const [folder, setFolder] = useState('INBOX');
  const [counts, setCounts] = useState<MailFolderCount[]>([]);
  const [customFolders, setCustomFolders] = useState<MailCustomFolder[]>([]);
  const [items, setItems] = useState<MailMessageSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<MailCustomFolder | null>(null);
  const [compose, setCompose] = useState<{ open: boolean; initial: ComposeDraft }>({
    open: false,
    initial: emptyDraft(),
  });
  const [reloadKey, setReloadKey] = useState(0);

  const searchActive = submittedQuery.trim().length > 0;

  const refreshCounts = useCallback(() => {
    folderCounts().then(setCounts).catch(() => {});
  }, []);
  const loadCustomFolders = useCallback(() => {
    listCustomFolders().then(setCustomFolders).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCounts();
    loadCustomFolders();
  }, [refreshCounts, loadCustomFolders, reloadKey]);

  // Latest state for the long-lived SSE handler (opened once).
  const folderRef = useRef(folder);
  const searchActiveRef = useRef(searchActive);
  useEffect(() => {
    folderRef.current = folder;
    searchActiveRef.current = searchActive;
  }, [folder, searchActive]);

  useEffect(() => {
    ensureNotificationPermission();
    const close = openMailEventStream({
      onOpen: () => {
        refreshCounts();
        loadCustomFolders();
      },
      onEvent: (ev) => {
        if (ev.type !== 'NEW_MAIL') return;
        refreshCounts();
        loadCustomFolders();
        const cur = folderRef.current;
        // Reload when viewing the folder the mail reports, or any custom folder
        // (a rule may file into a custom folder the event does not name).
        if (!searchActiveRef.current && (ev.folder === cur || !SYSTEM_FOLDERS.has(cur))) {
          reloadList();
        }
        notifyNewMail(ev.folder);
      },
    });
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCounts, loadCustomFolders]);

  // Close the mobile folder drawer on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    (async () => {
      try {
        const res = submittedQuery.trim()
          ? await searchMessages(submittedQuery.trim(), page, PAGE_SIZE)
          : folder === 'STARRED'
            ? await listStarred(page, PAGE_SIZE)
            : SYSTEM_FOLDERS.has(folder)
              ? await listFolder(folder, page, PAGE_SIZE)
              : await listCustomFolderMessages(folder, page, PAGE_SIZE);
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
    setDrawerOpen(false);
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
        setDetail({ ...d, isRead: true });
        setItems((prev) => prev.map((m) => (m.entryId === entryId ? { ...m, isRead: true } : m)));
        setMessageFlags(entryId, { isRead: true })
          .then(() => {
            refreshCounts();
            loadCustomFolders();
          })
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

  function closeReading() {
    setSelectedEntryId(null);
    setDetail(null);
  }

  async function onFlag(flags: { isRead?: boolean; isStarred?: boolean; isImportant?: boolean }) {
    if (!detail) return;
    try {
      const d = await setMessageFlags(detail.entryId, flags);
      setDetail(d);
      reloadList();
      refreshCounts();
      loadCustomFolders();
    } catch (e) {
      toast.error(mailErrorMessage(e));
    }
  }

  async function onMove(target: string) {
    if (!detail) return;
    try {
      if (target.startsWith('custom:')) {
        await moveMessageToCustomFolder(detail.entryId, target.slice('custom:'.length));
      } else {
        await moveMessage(detail.entryId, target);
      }
      toast.success('Moved');
      closeReading();
      reloadList();
      refreshCounts();
      loadCustomFolders();
    } catch (e) {
      toast.error(mailErrorMessage(e));
    }
  }

  async function onDelete() {
    if (!detail) return;
    try {
      if (detail.folder === 'TRASH' && !detail.customFolderId) {
        await deleteMessage(detail.entryId);
        toast.success('Deleted');
      } else {
        await moveMessage(detail.entryId, 'TRASH');
        toast.success('Moved to Trash');
      }
      closeReading();
      reloadList();
      refreshCounts();
      loadCustomFolders();
    } catch (e) {
      toast.error(mailErrorMessage(e));
    }
  }

  async function onCreateFolder(name: string) {
    try {
      await createCustomFolder(name);
      loadCustomFolders();
      toast.success('Folder created');
    } catch (e) {
      toast.error(mailErrorMessage(e, 'Could not create folder'));
    }
  }

  async function onRenameFolder(id: string, name: string) {
    try {
      await renameCustomFolder(id, name);
      loadCustomFolders();
    } catch (e) {
      toast.error(mailErrorMessage(e, 'Could not rename folder'));
    }
  }

  async function onConfirmDeleteFolder() {
    const f = confirmDeleteFolder;
    if (!f) return;
    try {
      await deleteCustomFolder(f.id);
      toast.success('Folder deleted — its messages moved to Trash');
      if (folder === f.id) selectFolder('INBOX');
      else {
        loadCustomFolders();
        refreshCounts();
        reloadList();
      }
    } catch (e) {
      toast.error(mailErrorMessage(e, 'Could not delete folder'));
    } finally {
      setConfirmDeleteFolder(null);
    }
  }

  const railProps = {
    counts,
    selected: searchActive ? '' : folder,
    onSelect: selectFolder,
    onCompose: () => openCompose(emptyDraft()),
    customFolders,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder: (f: MailCustomFolder) => setConfirmDeleteFolder(f),
  };

  const readingOpen = detail !== null || detailLoading;

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-10 flex overflow-hidden bg-white">
      {/* Desktop / tablet rail */}
      <FolderRail {...railProps} className="hidden h-full md:flex" />

      {/* Mobile folder drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 animate-fade-in bg-slate-900/40"
          />
          <div className="absolute inset-y-0 left-0 w-64 animate-fade-in bg-white shadow-xl">
            <FolderRail {...railProps} className="flex h-full" />
          </div>
        </div>
      )}

      {/* Message list — full width on mobile; hidden once a message opens. */}
      <div
        className={cn(
          'w-full flex-col border-r border-slate-200 md:w-96 md:shrink-0',
          readingOpen ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/60 p-2.5">
          <button
            type="button"
            aria-label="Open folders"
            onClick={() => setDrawerOpen(true)}
            className="shrink-0 rounded-md p-2 text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <form onSubmit={onSearchSubmit} className="min-w-0 flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject or people…"
              leftIcon={<Search className="h-4 w-4" />}
            />
          </form>
        </div>
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

      {/* Reading pane — full view on mobile when a message is open. */}
      <div className={cn('flex-1 flex-col', readingOpen ? 'flex' : 'hidden md:flex')}>
        {readingOpen && (
          <button
            type="button"
            onClick={closeReading}
            className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:text-brand-700 md:hidden"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        <ReadingPane
          detail={detail}
          loading={detailLoading}
          customFolders={customFolders}
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
          loadCustomFolders();
        }}
      />

      <ConfirmDialog
        open={!!confirmDeleteFolder}
        onClose={() => setConfirmDeleteFolder(null)}
        onConfirm={onConfirmDeleteFolder}
        title="Delete folder?"
        description={
          confirmDeleteFolder
            ? `"${confirmDeleteFolder.name}" will be removed and its messages moved to Trash.`
            : undefined
        }
        confirmLabel="Delete folder"
        variant="danger"
      />
    </div>
  );
}
