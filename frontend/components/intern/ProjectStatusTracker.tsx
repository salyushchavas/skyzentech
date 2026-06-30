'use client';

import StepperHorizontal from '@/components/ui/StepperHorizontal';
import type {
  AssignmentSummary,
  ProjectAssignmentStatus,
  TrainerDecision,
} from '@/app/careers/(dashboard)/intern/projects/types';
import { AlertTriangle } from 'lucide-react';

/**
 * Project status tracker — 6-step pipeline that mirrors the application
 * stepper visual (StepperHorizontal). Maps the real
 * {@link ProjectAssignmentStatus} + trainer decision to the visible step.
 *
 * <pre>
 *   1 Submitted        SUBMITTED (no trainer decision)
 *   2 Trainer review   SUBMITTED, trainer has the work
 *   3 Revisions        RETURNED or trainerDecision = REQUEST_REVISION
 *                      (conditional badge — loops back to step 1)
 *   4 Approved         TECH_APPROVED | PENDING_VIVA (trainer approved)
 *   5 Q&A              PENDING_VIVA (evaluator's Q&A session live)
 *   6 Completed        COMPLETED
 * </pre>
 */

export const PROJECT_TRACKER_STEPS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'trainer-review', label: 'Trainer review' },
  { key: 'approved', label: 'Approved' },
  { key: 'qa', label: 'Q&A session' },
  { key: 'completed', label: 'Completed' },
] as const;

export interface ProjectTrackerState {
  currentIndex: number;
  revisionRequested: boolean;
  nowLine: string;
}

export function projectTrackerStateFor(a: AssignmentSummary): ProjectTrackerState {
  const status: ProjectAssignmentStatus = a.status;
  const decision: TrainerDecision | null =
    a.latestSubmission?.trainerDecision ?? null;
  const revisionRequested =
    decision === 'REQUEST_REVISION' || status === 'RETURNED';

  // Step indices line up with PROJECT_TRACKER_STEPS above.
  let currentIndex = 0;
  let nowLine = '';
  switch (status) {
    case 'ASSIGNED':
    case 'IN_PROGRESS':
      currentIndex = revisionRequested ? 1 : -1;
      nowLine = revisionRequested
        ? 'Your trainer asked for revisions — update your work and re-submit.'
        : 'Working on the project — submit when ready.';
      break;
    case 'SUBMITTED':
      currentIndex = 1;
      nowLine = revisionRequested
        ? 'Your trainer asked for revisions — update your work and re-submit.'
        : 'Submitted and waiting for trainer review.';
      break;
    case 'RETURNED':
      currentIndex = 1;
      nowLine = 'Your trainer returned the project — see the notes below, update, and re-submit.';
      break;
    case 'TECH_APPROVED':
      currentIndex = 2;
      nowLine = 'Trainer approved — heading to your Evaluator for the Q&A session.';
      break;
    case 'PENDING_VIVA':
      currentIndex = 3;
      nowLine = a.qaSession
        ? 'Q&A session scheduled — see the Q&A card on the right for the join link and time.'
        : 'Awaiting the Evaluator to schedule your Q&A session. You\'ll be notified when it\'s booked.';
      break;
    case 'COMPLETED':
      currentIndex = 4;
      nowLine = 'Project completed and signed off. Nice work.';
      break;
    default:
      currentIndex = -1;
      nowLine = '';
  }
  return { currentIndex, revisionRequested, nowLine };
}

interface Props {
  assignment: AssignmentSummary;
  className?: string;
}

export default function ProjectStatusTracker({ assignment, className }: Props) {
  const { currentIndex, revisionRequested, nowLine } =
    projectTrackerStateFor(assignment);
  return (
    <section
      aria-label="Project status tracker"
      className={
        (className ?? '')
        + ' overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm'
      }
    >
      <div className="min-w-[40rem]">
        <StepperHorizontal
          steps={[...PROJECT_TRACKER_STEPS]}
          currentIndex={currentIndex}
        />
      </div>
      {(nowLine || revisionRequested) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
          {revisionRequested && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
              <AlertTriangle className="h-3 w-3" />
              Revisions requested
            </span>
          )}
          {nowLine && (
            <p className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Now:</span>{' '}
              {nowLine}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
