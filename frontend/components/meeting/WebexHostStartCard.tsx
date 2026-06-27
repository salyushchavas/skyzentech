'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, Video } from 'lucide-react';
import api from '@/lib/api';

/**
 * Scheduler-facing "Start Meeting (Host)" card. Renders the Zoom
 * {@code start_url} (one-click host link, no Zoom sign-in needed) as a
 * primary button, with a Refresh affordance underneath.
 *
 * <p>Zoom's {@code start_url} is short-lived (~2h after meeting create)
 * so a stale stored copy stops working before the meeting starts. On
 * mount this card calls {@code GET /api/v1/meetings/{id}/host-start}
 * which re-fetches the meeting via the provider and returns the current
 * {@code start_url}. The stored value passed in by the parent is shown
 * as a fallback when the fresh fetch is in-flight or fails.</p>
 *
 * <p>Intern/participant surfaces should NOT use this component — they
 * get a plain join button via their own DTOs (no zoomStartUrl).</p>
 */
export default function WebexHostStartCard({
  providerMeetingId,
  joinUrl,
  startUrl,
}: {
  providerMeetingId: string | null | undefined;
  joinUrl: string | null | undefined;
  startUrl?: string | null | undefined;
}) {
  const [freshStartUrl, setFreshStartUrl] = useState<string | null>(
    startUrl ?? null,
  );
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchFresh = useCallback(async () => {
    if (!providerMeetingId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.get<{
        startUrl: string | null;
        joinUrl: string | null;
        available: boolean;
      }>(`/api/v1/meetings/${encodeURIComponent(providerMeetingId)}/host-start`);
      if (res.data?.startUrl) {
        setFreshStartUrl(res.data.startUrl);
      }
      setFetchedAt(new Date());
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to refresh start URL');
    } finally {
      setBusy(false);
    }
  }, [providerMeetingId]);

  // Fetch fresh on mount — Zoom start_url expires ~2h after meeting create,
  // so the stored copy passed in by the parent may be stale by the time
  // the scheduler opens the modal.
  useEffect(() => {
    void fetchFresh();
  }, [fetchFresh]);

  const hostHref = freshStartUrl ?? startUrl ?? null;
  const joinHref = joinUrl ?? null;

  if (!hostHref && !joinHref) return null;

  return (
    <div className="space-y-2">
      {hostHref && (
        <a
          href={hostHref}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-accent to-accent-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-accent-dark hover:to-accent-dark"
        >
          <Video className="h-4 w-4" />
          Start Meeting (Host)
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {providerMeetingId && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600">
          <div className="flex items-center justify-between gap-2">
            <span className="leading-snug">
              One-click host link (Zoom <code>start_url</code>) &mdash; no
              Zoom sign-in needed. Expires roughly 2 hours after the meeting
              was created.
            </span>
            <button
              type="button"
              onClick={fetchFresh}
              disabled={busy}
              title="Re-fetch (start link rotates every ~2h)"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {busy ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
          {fetchedAt && !err && (
            <p className="mt-1 text-[10px] text-slate-500">
              Refreshed {fetchedAt.toLocaleTimeString()}
            </p>
          )}
          {err && (
            <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 p-1.5 text-[11px] text-amber-800">
              Couldn&rsquo;t refresh: {err}. Using the stored link &mdash; if
              it errors in Zoom, click Refresh again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
