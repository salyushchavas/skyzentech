'use client';

import { useState } from 'react';
import api from '@/lib/api';

type Props = {
  itemIds: string[];
  onClose: () => void;
  onDone: () => void;
};

export default function BulkReviewModal({ itemIds, onClose, onDone }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    accepted: number;
    skipped: number;
    skippedReasons: { itemId: string; reason: string }[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await api.post<typeof result>(
        '/api/v1/erm/onboarding/items/bulk-review',
        { itemIds, decision: 'ACCEPT' },
      );
      setResult(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Bulk review failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Bulk-accept {itemIds.length} item(s)
          </h3>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700">
          {!result ? (
            <p>
              This accepts every selected SUBMITTED item with no reason code.
              REJECT and RESEND require per-item comments and must be done one
              at a time.
            </p>
          ) : (
            <div className="space-y-2">
              <p>
                Accepted: <strong>{result.accepted}</strong> · Skipped:{' '}
                <strong>{result.skipped}</strong>
              </p>
              {result.skippedReasons.length > 0 && (
                <ul className="max-h-40 list-disc overflow-auto pl-5 text-xs text-slate-600">
                  {result.skippedReasons.map((r) => (
                    <li key={r.itemId}>
                      <code className="text-[11px]">
                        {r.itemId.slice(0, 8)}
                      </code>{' '}
                      — {r.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {err && (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {err}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          {!result ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? 'Accepting…' : 'Accept all'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onDone}
              className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
