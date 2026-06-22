// Mirrors ProjectAssignmentResponse on the backend. Only the fields the
// intern surface consumes are typed here.

export type ProjectAssignmentStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'TECH_APPROVED'
  | 'PENDING_VIVA'
  | 'COMPLETED';

export type TrainerDecision =
  | 'ACCEPT'
  | 'REQUEST_REVISION'
  | 'ESCALATE'
  | 'NO_ACTION_YET';

export interface KtSummary {
  status: 'NOT_DONE' | 'DONE';
  completedAt: string | null;
  meetingLink: string | null;
  notes: string | null;
  markedByName: string | null;
}

export interface ProjectRef {
  id: string;
  name: string | null;
  techStack: string | null;
  difficulty: string | null;
  description: string | null;
  requirements: string | null;
  objectives: string | null;
  deliverables: string | null;
  instructions: string | null;
  expectedDurationDays: number | null;
  startDate: string | null;
  endDate: string | null;
  repository: { repositoryName: string | null; repositoryUrl: string | null } | null;
  kt: KtSummary | null;
}

export interface LatestSubmission {
  id: string;
  version: number;
  links: string[];
  description: string | null;
  submittedAt: string;
  trainerDecision: TrainerDecision | null;
  trainerFeedback: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
}

export interface UserRef {
  id: string;
  fullName: string | null;
  email: string | null;
  githubUsername: string | null;
}

export interface AssignmentSummary {
  id: string;
  project: ProjectRef | null;
  /** Backend's UserRef intern — includes githubUsername so the intern UI
   *  can decide whether to prompt for one before the Start button enables. */
  intern: UserRef | null;
  status: ProjectAssignmentStatus;
  assignmentDate: string | null;
  dueDate: string | null;
  remarks: string | null;
  accessGranted: boolean | null;
  startedAt: string | null;
  submittedAt: string | null;
  submissionNotes: string | null;
  latestSubmission: LatestSubmission | null;
}
