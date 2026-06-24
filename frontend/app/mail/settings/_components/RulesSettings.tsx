'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  createRule,
  deleteRule,
  listCustomFolders,
  listRules,
  mailErrorMessage,
  updateRule,
  type MailCustomFolder,
  type MailRuleAction,
  type MailRuleActionType,
  type MailRuleCondition,
  type MailRuleField,
  type MailRuleMatchMode,
  type MailRuleOperator,
  type MailRuleRequest,
  type MailRuleResponse,
} from '@/lib/mail-client';

const FIELD_LABEL: Record<MailRuleField, string> = {
  FROM: 'From',
  TO: 'To',
  CC: 'Cc',
  SUBJECT: 'Subject',
  HAS_ATTACHMENT: 'Has attachment',
};
const OP_LABEL: Record<MailRuleOperator, string> = {
  CONTAINS: 'contains',
  EQUALS: 'equals',
  IS_TRUE: 'is present',
};
const ACTION_LABEL: Record<MailRuleActionType, string> = {
  MOVE_TO_FOLDER: 'Move to folder',
  MARK_READ: 'Mark as read',
  STAR: 'Star',
  MARK_IMPORTANT: 'Mark important',
  DELETE: 'Delete (to Trash)',
};
const FIELDS: MailRuleField[] = ['FROM', 'TO', 'CC', 'SUBJECT', 'HAS_ATTACHMENT'];
const TEXT_OPS: MailRuleOperator[] = ['CONTAINS', 'EQUALS'];
const ACTION_TYPES: MailRuleActionType[] = ['MOVE_TO_FOLDER', 'MARK_READ', 'STAR', 'MARK_IMPORTANT', 'DELETE'];
const MOVE_TARGETS = ['INBOX', 'ARCHIVE', 'TRASH'];

type EditCondition = { field: MailRuleField; operator: MailRuleOperator; value: string };
// `target` is a system folder name (e.g. ARCHIVE) OR a custom folder as "custom:<id>".
type EditAction = { type: MailRuleActionType; target: string };
type EditState = {
  id?: string;
  name: string;
  priority: number;
  enabled: boolean;
  matchMode: MailRuleMatchMode;
  stopProcessing: boolean;
  conditions: EditCondition[];
  actions: EditAction[];
};

const SELECT_CLASS =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500';

function newRule(): EditState {
  return {
    name: '',
    priority: 100,
    enabled: true,
    matchMode: 'ALL',
    stopProcessing: false,
    conditions: [{ field: 'FROM', operator: 'CONTAINS', value: '' }],
    actions: [{ type: 'MOVE_TO_FOLDER', target: 'ARCHIVE' }],
  };
}

function fromResponse(r: MailRuleResponse): EditState {
  return {
    id: r.id,
    name: r.name,
    priority: r.priority,
    enabled: r.enabled,
    matchMode: r.matchMode,
    stopProcessing: r.stopProcessing,
    conditions: r.conditions.map((c) => ({
      field: c.field,
      operator: c.field === 'HAS_ATTACHMENT' ? 'IS_TRUE' : c.operator === 'IS_TRUE' ? 'CONTAINS' : c.operator,
      value: c.value ?? '',
    })),
    actions: r.actions.map((a) => ({
      type: a.type,
      target: a.targetCustomFolderId
        ? `custom:${a.targetCustomFolderId}`
        : a.targetFolder ?? 'ARCHIVE',
    })),
  };
}

function toRequest(e: EditState): MailRuleRequest {
  const conditions: MailRuleCondition[] = e.conditions.map((c) =>
    c.field === 'HAS_ATTACHMENT'
      ? { field: c.field, operator: 'IS_TRUE' }
      : { field: c.field, operator: c.operator, value: c.value.trim() },
  );
  const actions: MailRuleAction[] = e.actions.map((a) => {
    if (a.type !== 'MOVE_TO_FOLDER') return { type: a.type };
    return a.target.startsWith('custom:')
      ? { type: a.type, targetCustomFolderId: a.target.slice('custom:'.length) }
      : { type: a.type, targetFolder: a.target };
  });
  return {
    name: e.name.trim(),
    priority: e.priority,
    enabled: e.enabled,
    matchMode: e.matchMode,
    stopProcessing: e.stopProcessing,
    conditions,
    actions,
  };
}

function summarize(c: MailRuleCondition): string {
  if (c.field === 'HAS_ATTACHMENT') return 'Has attachment';
  return `${FIELD_LABEL[c.field]} ${OP_LABEL[c.operator]} "${c.value ?? ''}"`;
}

function summarizeAction(a: MailRuleAction, customFolders: MailCustomFolder[]): string {
  if (a.type === 'MOVE_TO_FOLDER') {
    if (a.targetCustomFolderId) {
      const f = customFolders.find((c) => c.id === a.targetCustomFolderId);
      return `Move to ${f ? f.name : 'folder'}`;
    }
    return `Move to ${a.targetFolder ?? '?'}`;
  }
  return ACTION_LABEL[a.type];
}

export default function RulesSettings() {
  const [rules, setRules] = useState<MailRuleResponse[]>([]);
  const [customFolders, setCustomFolders] = useState<MailCustomFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MailRuleResponse | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [r, f] = await Promise.all([listRules(), listCustomFolders().catch(() => [])]);
      setRules(r);
      setCustomFolders(f);
    } catch (e) {
      toast.error(mailErrorMessage(e, 'Failed to load rules'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onToggleEnabled(r: MailRuleResponse) {
    try {
      await updateRule(r.id, { ...toRequest(fromResponse(r)), enabled: !r.enabled });
      await reload();
    } catch (e) {
      toast.error(mailErrorMessage(e, 'Could not update rule'));
    }
  }

  async function onConfirmDelete() {
    if (!confirmDelete) return;
    try {
      await deleteRule(confirmDelete.id);
      toast.success('Rule deleted');
      await reload();
    } catch (e) {
      toast.error(mailErrorMessage(e, 'Could not delete rule'));
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/mail" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">Inbox rules</h1>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing(newRule())}>
          New rule
        </Button>
      </div>

      <p className="text-sm text-slate-500">
        Rules run on incoming mail in priority order (lowest first). A failing rule never blocks delivery.
      </p>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Loading…
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No rules yet. Create one to auto-sort, star, or archive incoming mail.
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{r.name}</span>
                  <span className="text-xs text-slate-400">priority {r.priority}</span>
                  {!r.enabled && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500">If {r.matchMode === 'ALL' ? 'all' : 'any'}:</span>
                  {r.conditions.map((c, i) => (
                    <span key={i} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-700">
                      {summarize(c)}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Then:</span>
                  {r.actions.map((a, i) => (
                    <span key={i} className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-brand-700">
                      {summarizeAction(a, customFolders)}
                    </span>
                  ))}
                  {r.stopProcessing && <span className="text-slate-400">· stop</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={() => void onToggleEnabled(r)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                  />
                  Enabled
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Pencil className="h-4 w-4" />}
                  onClick={() => setEditing(fromResponse(r))}
                >
                  Edit
                </Button>
                <button
                  type="button"
                  title="Delete rule"
                  onClick={() => setConfirmDelete(r)}
                  className="rounded p-1.5 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RuleEditorModal
          initial={editing}
          customFolders={customFolders}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={onConfirmDelete}
        title="Delete rule?"
        description={confirmDelete ? `"${confirmDelete.name}" will no longer run on incoming mail.` : undefined}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function RuleEditorModal({
  initial,
  customFolders,
  onClose,
  onSaved,
}: {
  initial: EditState;
  customFolders: MailCustomFolder[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [edit, setEdit] = useState<EditState>(initial);
  const [busy, setBusy] = useState(false);

  function patch(p: Partial<EditState>) {
    setEdit((e) => ({ ...e, ...p }));
  }

  function setCondition(i: number, c: Partial<EditCondition>) {
    setEdit((e) => ({
      ...e,
      conditions: e.conditions.map((cur, idx) => (idx === i ? { ...cur, ...c } : cur)),
    }));
  }

  function setAction(i: number, a: Partial<EditAction>) {
    setEdit((e) => ({
      ...e,
      actions: e.actions.map((cur, idx) => (idx === i ? { ...cur, ...a } : cur)),
    }));
  }

  function onActionTypeChange(i: number, type: MailRuleActionType) {
    // Keep target coherent: only MOVE_TO_FOLDER carries one (default ARCHIVE when
    // switching in), every other type clears it so no stale value lingers.
    setEdit((e) => ({
      ...e,
      actions: e.actions.map((cur, idx) =>
        idx === i
          ? { type, target: type === 'MOVE_TO_FOLDER' ? cur.target || 'ARCHIVE' : '' }
          : cur,
      ),
    }));
  }

  function onFieldChange(i: number, field: MailRuleField) {
    // Keep operator coherent with the chosen field.
    setCondition(i, {
      field,
      operator: field === 'HAS_ATTACHMENT' ? 'IS_TRUE' : 'CONTAINS',
    });
  }

  async function onSave() {
    if (busy) return;
    if (!edit.name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (edit.conditions.length === 0) {
      toast.error('Add at least one condition');
      return;
    }
    const blank = edit.conditions.find((c) => c.field !== 'HAS_ATTACHMENT' && !c.value.trim());
    if (blank) {
      toast.error('Every text condition needs a value');
      return;
    }
    if (edit.actions.length === 0) {
      toast.error('Add at least one action');
      return;
    }
    setBusy(true);
    try {
      const req = toRequest(edit);
      if (edit.id) {
        await updateRule(edit.id, req);
        toast.success('Rule updated');
      } else {
        await createRule(req);
        toast.success('Rule created');
      }
      onSaved();
    } catch (e) {
      toast.error(mailErrorMessage(e, 'Could not save rule'));
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
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">{edit.id ? 'Edit rule' : 'New rule'}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <Input
            value={edit.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Rule name"
          />

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              Match
              <select
                value={edit.matchMode}
                onChange={(e) => patch({ matchMode: e.target.value as MailRuleMatchMode })}
                className={SELECT_CLASS}
              >
                <option value="ALL">all conditions</option>
                <option value="ANY">any condition</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Priority
              <input
                type="number"
                value={edit.priority}
                onChange={(e) => patch({ priority: Number(e.target.value) || 0 })}
                className={SELECT_CLASS + ' w-20'}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={edit.stopProcessing}
                onChange={(e) => patch({ stopProcessing: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
              />
              Stop after this rule
            </label>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Conditions</div>
            {edit.conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={c.field}
                  onChange={(e) => onFieldChange(i, e.target.value as MailRuleField)}
                  className={SELECT_CLASS}
                >
                  {FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABEL[f]}
                    </option>
                  ))}
                </select>
                {c.field === 'HAS_ATTACHMENT' ? (
                  <span className="text-sm text-slate-500">is present</span>
                ) : (
                  <>
                    <select
                      value={c.operator}
                      onChange={(e) => setCondition(i, { operator: e.target.value as MailRuleOperator })}
                      className={SELECT_CLASS}
                    >
                      {TEXT_OPS.map((op) => (
                        <option key={op} value={op}>
                          {OP_LABEL[op]}
                        </option>
                      ))}
                    </select>
                    <div className="min-w-[8rem] flex-1">
                      <Input
                        value={c.value}
                        onChange={(e) => setCondition(i, { value: e.target.value })}
                        placeholder="value"
                      />
                    </div>
                  </>
                )}
                {edit.conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      patch({ conditions: edit.conditions.filter((_, idx) => idx !== i) })
                    }
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    title="Remove condition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() =>
                patch({ conditions: [...edit.conditions, { field: 'FROM', operator: 'CONTAINS', value: '' }] })
              }
            >
              Add condition
            </Button>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Actions</div>
            {edit.actions.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={a.type}
                  onChange={(e) => onActionTypeChange(i, e.target.value as MailRuleActionType)}
                  className={SELECT_CLASS}
                >
                  {ACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ACTION_LABEL[t]}
                    </option>
                  ))}
                </select>
                {a.type === 'MOVE_TO_FOLDER' && (
                  <select
                    value={a.target}
                    onChange={(e) => setAction(i, { target: e.target.value })}
                    className={SELECT_CLASS}
                  >
                    <optgroup label="System">
                      {MOVE_TARGETS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </optgroup>
                    {customFolders.length > 0 && (
                      <optgroup label="Folders">
                        {customFolders.map((c) => (
                          <option key={c.id} value={`custom:${c.id}`}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
                {edit.actions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => patch({ actions: edit.actions.filter((_, idx) => idx !== i) })}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    title="Remove action"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => patch({ actions: [...edit.actions, { type: 'STAR', target: '' }] })}
            >
              Add action
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={busy}>
            {edit.id ? 'Save changes' : 'Create rule'}
          </Button>
        </div>
      </div>
    </div>
  );
}
