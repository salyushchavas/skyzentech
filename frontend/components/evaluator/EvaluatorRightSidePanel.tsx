'use client';

import {
  CalendarPlus,
  ClipboardEdit,
  FileCheck,
  FileText,
  Lock,
  Send,
} from 'lucide-react';

interface QuickAction {
  key: string;
  label: string;
  phase: number;
  icon: React.ReactNode;
}

const ACTIONS: QuickAction[] = [
  { key: 'schedule',  label: 'Schedule Session',      phase: 2, icon: <CalendarPlus className="h-3.5 w-3.5" /> },
  { key: 'compose',   label: 'Compose Evaluation',    phase: 2, icon: <ClipboardEdit className="h-3.5 w-3.5" /> },
  { key: 'publish',   label: 'Publish Feedback',      phase: 2, icon: <Send className="h-3.5 w-3.5" /> },
  { key: 'ack',       label: 'Request Acknowledgment', phase: 2, icon: <FileCheck className="h-3.5 w-3.5" /> },
  { key: 'i983',      label: 'Start I-983 Evaluation', phase: 3, icon: <FileText className="h-3.5 w-3.5" /> },
];

/**
 * Evaluator Phase 0 — right-side panel scaffolding. All 5 quick actions
 * are disabled with a "Coming in Evaluator Phase N" tooltip. The cycle
 * badge is a placeholder until Phase 1 wires real counts.
 */
export default function EvaluatorRightSidePanel() {
  const monthLabel = new Date().toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  return (
    <aside className="hidden h-screen w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-50 xl:flex">
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Current cycle
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">{monthLabel}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          0 evaluations published this month
        </p>
        <p className="text-[10px] text-slate-400">(Live counts ship in Phase 1)</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Quick actions
        </p>
        <ul className="mt-2 space-y-1">
          {ACTIONS.map((a) => (
            <li key={a.key}>
              <button
                type="button"
                disabled
                title={`Coming in Evaluator Phase ${a.phase}`}
                className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-500 opacity-70 hover:opacity-90"
              >
                <span className="inline-flex items-center gap-1.5">
                  {a.icon}
                  {a.label}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                  <Lock className="h-3 w-3" />
                  P{a.phase}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Context
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Open an Active Evaluees row to see that intern's evaluation
            history + last cycle outcome here.
          </p>
          <p className="mt-2 text-[10px] text-slate-400">
            (Wires up in Evaluator Phase 1.)
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500">
        Evaluator dashboard · Phase 0 scaffold
      </div>
    </aside>
  );
}
