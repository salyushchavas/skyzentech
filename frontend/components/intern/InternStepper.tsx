'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface InternStepperStep {
  key: string;
  label: string;
  status: 'DONE' | 'ACTIVE' | 'UPCOMING';
}

interface Props {
  steps: InternStepperStep[];
}

/**
 * Universal 9-step intern-journey stepper. Horizontal on md+, vertical on
 * mobile. Visual states match the Phase 1 doc — DONE (emerald), ACTIVE
 * (teal-700), UPCOMING (slate outline). Connectors track the upstream
 * step's done-ness.
 */
export default function InternStepper({ steps }: Props) {
  if (!steps?.length) return null;

  return (
    <nav aria-label="Intern journey" className="mb-6">
      <ol className="hidden md:flex md:items-start md:gap-0">
        {steps.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-start">
            <StepCircle step={s} index={i} />
            {i < steps.length - 1 && <Connector prevDone={s.status === 'DONE'} />}
          </li>
        ))}
      </ol>
      <ol className="space-y-3 md:hidden">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3">
            <CircleBadge step={s} index={i} compact />
            <span className={cn('text-sm', labelClass(s.status))}>{s.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StepCircle({ step, index }: { step: InternStepperStep; index: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <CircleBadge step={step} index={index} />
      <span
        className={cn(
          'max-w-[7.5rem] text-center text-xs leading-tight',
          labelClass(step.status),
        )}
      >
        {step.label}
      </span>
    </div>
  );
}

function CircleBadge({
  step,
  index,
  compact,
}: {
  step: InternStepperStep;
  index: number;
  compact?: boolean;
}) {
  const size = compact ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  const base =
    'flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors';
  if (step.status === 'DONE') {
    return (
      <span
        className={cn(base, size, 'bg-emerald-600 text-white shadow-sm')}
        aria-label={`${step.label} (done)`}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  if (step.status === 'ACTIVE') {
    return (
      <span
        className={cn(base, size, 'bg-teal-700 text-white shadow-sm ring-2 ring-teal-200 ring-offset-2')}
        aria-current="step"
      >
        {index + 1}
      </span>
    );
  }
  return (
    <span
      className={cn(
        base,
        size,
        'border border-slate-300 bg-white text-slate-400',
      )}
    >
      {index + 1}
    </span>
  );
}

function Connector({ prevDone }: { prevDone: boolean }) {
  return (
    <div
      className={cn(
        'mt-4 h-0.5 flex-1 transition-colors',
        prevDone ? 'bg-emerald-600' : 'bg-slate-200',
      )}
      aria-hidden
    />
  );
}

function labelClass(status: InternStepperStep['status']): string {
  switch (status) {
    case 'DONE':
      return 'text-slate-700';
    case 'ACTIVE':
      return 'font-semibold text-slate-900';
    case 'UPCOMING':
    default:
      return 'text-slate-400';
  }
}
