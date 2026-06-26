'use client';

import { useCallback, useState } from 'react';
import { Copy, ExternalLink, Eye, KeyRound, Loader2, RefreshCw, Video } from 'lucide-react';
import api from '@/lib/api';

/**
 * Scheduler-facing "join + claim host" card. Renders:
 *  1. The webLink as a primary "Start Meeting (Host)" button
 *     (host start link doesn't exist for our Webex tier — see
 *     project-webex-integration-setup memory).
 *  2. A "Reveal host key" affordance that on click fetches
 *     `GET /api/v1/meetings/{providerMeetingId}/host-key` and shows the
 *     6-digit code. Fetch is on-demand because Webex rotates the key
 *     after each scheduled-end — a cached value goes silently stale.
 *  3. A short hint explaining how the host key claims host role inside
 *     the Webex client.
 *
 * Intern/participant surfaces should NOT use this component — they get a
 * plain join button via their own DTOs (no zoomStartUrl, no host key).
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
  const targetUrl = startUrl ?? joinUrl ?? null;
  const [hostKey, setHostKey] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKey = useCallback(async () => {
    if (!providerMeetingId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.get<{ hostKey: string | null; available: boolean }>(
        `/api/v1/meetings/${encodeURIComponent(providerMeetingId)}/host-key`,
      );
      setHostKey(res.data?.hostKey ?? null);
      setAvailable(res.data?.available ?? false);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Failed to fetch host key');
      setHostKey(null);
      setAvailable(false);
    } finally {
      setBusy(false);
    }
  }, [providerMeetingId]);

  const copy = useCallback(async () => {
    if (!hostKey) return;
    try {
      await navigator.clipboard.writeText(hostKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard denied — user can still read + type the 6 digits
    }
  }, [hostKey]);

  if (!targetUrl) return null;

  return (
    <div className="space-y-2">
      <a
        href={targetUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-accent to-accent-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-accent-dark hover:to-accent-dark"
      >
        <Video className="h-4 w-4" />
        Start Meeting (Host)
        <ExternalLink className="h-3 w-3" />
      </a>

      {providerMeetingId && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800">
                You&rsquo;re the host — claim host control with the host key
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                Join via the button above, then open the Webex menu &gt;
                <span className="italic"> Reclaim host role</span> and enter the
                6-digit key below. The meeting is scheduled under our service
                account; this key transfers host control to you.
              </p>

              {hostKey == null && available == null && !err && (
                <button
                  type="button"
                  onClick={fetchKey}
                  disabled={busy}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Fetching&hellip;
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" /> Reveal host key
                    </>
                  )}
                </button>
              )}

              {hostKey && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded-md border border-slate-300 bg-white px-3 py-1 font-mono text-base tracking-[0.3em] text-slate-900">
                    {hostKey}
                  </code>
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={fetchKey}
                    disabled={busy}
                    title="Re-fetch (host key rotates after each meeting ends)"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RefreshCw className={'h-3 w-3 ' + (busy ? 'animate-spin' : '')} />
                  </button>
                </div>
              )}

              {available === false && hostKey == null && !err && (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                  Host key isn&rsquo;t available for this meeting. Sign in to
                  webex.com as the host account first, then click Start Meeting
                  &mdash; you&rsquo;ll be promoted to host automatically.
                </p>
              )}

              {err && (
                <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-800">
                  {err}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
