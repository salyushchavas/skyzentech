'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import ExitTypePill from '@/components/exit/ExitTypePill';
import InitiateExitModal from '@/components/exit/InitiateExitModal';

interface PendingItem {
  internLifecycleId: string;
  internId: string;
  internName: string | null;
  internEmail: string | null;
  hiredAt: string | null;
  signals: string[];
}

interface ExitRecord {
  id: string;
  internLifecycleId: string;
  internId: string;
  internName: string | null;
  internEmail: string | null;
  exitType: string;
  exitDate: string;
  rehireEligible: boolean | null;
  accessRevocationDone: boolean | null;
  finalDocumentsArchived: boolean | null;
  finalEvaluationId: string | null;
  createdAt: string;
}

interface ListPage {
  items: ExitRecord[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export default function ErmExitsPage() {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [records, setRecords] = useState<ExitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<{ lifecycleId: string; name: string | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        api.get<PendingItem[]>('/api/v1/exit/pending'),
        api.get<ListPage>('/api/v1/exit/records?page=0&pageSize=50'),
      ]);
      setPending(p.data ?? []);
      setRecords(r.data?.items ?? []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load exits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function checklistDone(r: ExitRecord): number {
    let n = 0;
    if (r.finalEvaluationId) n++;
    if (r.accessRevocationDone) n++;
    if (r.finalDocumentsArchived) n++;
    return n;
  }

  return (
    <>
      <PageHeader
        title="Exits"
        subtitle="Initiate intern exits and track checklist completion."
      />

      {err && (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {err}
        </p>
      )}

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Ready to exit</h2>
        <p className="mt-1 text-xs text-slate-500">
          Active interns with signals suggesting they're ready for an exit transition.
        </p>
        {loading && <div className="mt-3 h-16 animate-pulse rounded-md bg-slate-50" />}
        {!loading && pending.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No interns currently flagged.</p>
        )}
        {!loading && pending.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.internLifecycleId} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {p.internName ?? '(unnamed)'}
                  </div>
                  <div className="text-xs text-slate-500">{p.internEmail}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.signals.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-800"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setModal({ lifecycleId: p.internLifecycleId, name: p.internName })
                  }
                  className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  Initiate exit
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Recent exits</h2>
        {loading && <div className="mt-3 h-16 animate-pulse rounded-md bg-slate-50" />}
        {!loading && records.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No exit records yet.</p>
        )}
        {!loading && records.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100">
            {records.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Link href={`/careers/erm/exits/${r.id}`} className="hover:underline">
                      {r.internName ?? '(unnamed)'}
                    </Link>
                    <ExitTypePill exitType={r.exitType} />
                  </div>
                  <div className="text-xs text-slate-500">
                    Exit {r.exitDate} · Checklist {checklistDone(r)} of 3 done
                  </div>
                </div>
                <Link
                  href={`/careers/erm/exits/${r.id}`}
                  className="text-xs font-medium text-teal-700 hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal && (
        <InitiateExitModal
          open
          internLifecycleId={modal.lifecycleId}
          internName={modal.name}
          onClose={() => {
            setModal(null);
            void load();
          }}
        />
      )}
    </>
  );
}
