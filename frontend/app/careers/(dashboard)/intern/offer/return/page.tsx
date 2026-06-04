'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import InternPageShell from '@/components/intern/InternPageShell';
import type { CandidateOfferResponse } from '@/types';

/**
 * DocuSign returnUrl handler. Reads ?event= and either polls /offers/mine
 * waiting for the webhook to flip the row to SIGNED, or redirects back with
 * an appropriate toast-equivalent banner for cancel/decline.
 */
export default function OfferReturnPage() {
  return (
    <Suspense fallback={<InternPageShell title="Processing signature…" />}>
      <OfferReturnInner />
    </Suspense>
  );
}

function OfferReturnInner() {
  const router = useRouter();
  const search = useSearchParams();
  const event = (search?.get('event') ?? '').toLowerCase();
  const [msg, setMsg] = useState('Returning from DocuSign…');
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => {
    if (event === 'cancel') {
      setMsg('Signing cancelled. You can resume any time from the Offer Letter page.');
      const t = window.setTimeout(() => router.replace('/careers/intern/offer'), 1800);
      return () => window.clearTimeout(t);
    }
    if (event === 'decline') {
      setMsg('Offer declined. Contact ERM if this was a mistake.');
      const t = window.setTimeout(() => router.replace('/careers/intern/offer'), 2200);
      return () => window.clearTimeout(t);
    }
    // Default + signing_complete: poll for the SIGNED flip.
    stopRef.current = false;
    setMsg('Signature captured — finalising your offer…');
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s
    const interval = window.setInterval(async () => {
      if (stopRef.current) return;
      attempts++;
      try {
        const res = await api.get<CandidateOfferResponse[]>('/api/v1/offers/mine');
        const list = res.data ?? [];
        const latest = [...list].sort((a, b) =>
          (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))[0];
        if (latest && (latest.status === 'SIGNED' || latest.status === 'ACCEPTED')) {
          stopRef.current = true;
          window.clearInterval(interval);
          setDone(true);
          setMsg('Welcome aboard! Redirecting…');
          window.setTimeout(() => router.replace('/careers/intern/offer'), 1200);
          return;
        }
      } catch {
        // Swallow — keep polling until maxAttempts.
      }
      if (attempts >= maxAttempts) {
        stopRef.current = true;
        window.clearInterval(interval);
        setMsg('Still finalising. Open the Offer Letter page in a few moments.');
        window.setTimeout(() => router.replace('/careers/intern/offer'), 2000);
      }
    }, 2000);
    return () => {
      stopRef.current = true;
      window.clearInterval(interval);
    };
  }, [event, router]);

  return (
    <InternPageShell title="Offer Letter">
      <section className="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
        {done ? (
          <CheckCircle2 className="h-10 w-10 text-emerald-600" strokeWidth={2} />
        ) : (
          <Loader2 className="h-10 w-10 animate-spin text-teal-700" strokeWidth={2} />
        )}
        <p className="mt-3 text-sm text-slate-700">{msg}</p>
      </section>
    </InternPageShell>
  );
}
