// Evaluator Phase 1 — shared types for dashboard, evaluees list/detail,
// and right-side panel. Mirrors EvaluatorDtos.java on the backend.

export interface CallerView {
  userId: string;
  fullName: string;
  email: string;
}

export interface KpiSnapshot {
  key: string;
  label: string;
  count: number;
  urgentCount: number;
  helperText: string | null;
  actionUrl: string;
}

export interface DashboardResponse {
  caller: CallerView;
  monthYearLabel: string;
  kpis: KpiSnapshot[];
}

export interface ActiveEvalueeRow {
  lifecycleId: string;
  internUserId: string;
  internName: string | null;
  employeeId: string | null;
  technology: string | null;
  workAuthType: string | null;
  startedAt: string | null;
  monthsInProgram: number;
  lastEvaluationAt: string | null;
  lastEvaluationStatus: string | null;
  lastEvaluationType: string | null;
  pendingAckCount: number;
  i983DueWithinDays: number | null;
  trainerName: string | null;
  ermName: string | null;
}

export interface ActiveEvalueesPage {
  items: ActiveEvalueeRow[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface EvalueeProfile {
  lifecycleId: string;
  internUserId: string;
  internName: string | null;
  internEmail: string | null;
  applicantId: string | null;
  employeeId: string | null;
  technology: string | null;
  workAuthType: string | null;
  startedAt: string | null;
  monthsInProgram: number;
  totalEvaluationsToDate: number;
  lastEvaluationAt: string | null;
}

export interface CurrentMonthCard {
  monthStatus: string;
  monthYearLabel: string;
  currentEvaluationId: string | null;
  publishedAt: string | null;
  daysSincePublish: number | null;
  actionNeeded: boolean;
}

export interface HistorySummaryCard {
  totalEvaluations: number;
  averageOverallScore: number | null;
  trend: string;
}

export interface I983StatusCard {
  planStatus: string;
  lastI983EvaluationAt: string | null;
  lastI983Status: string | null;
  nextDueDate: string | null;
  daysUntilNext: number | null;
}

export interface TrainerContextCard {
  currentProjectId: string | null;
  currentProjectTitle: string | null;
  currentProjectStatus: string | null;
  currentProjectDueDate: string | null;
  lastFeedbackDecision: string | null;
  lastFeedbackAt: string | null;
  lastMeetingScheduledFor: string | null;
  lastMeetingStatus: string | null;
  daysSinceLastMeeting: number | null;
  trainerName: string | null;
}

export interface EvaluationTimelineEntry {
  evaluationId: string;
  entryKind: 'INTERN_EVALUATION' | 'I983_EVALUATION';
  evaluationType: string | null;
  status: string | null;
  publishedAt: string | null;
  acknowledgedAt: string | null;
  overallScore: number | null;
  summary: string | null;
}

export interface EvalueeDetail {
  profile: EvalueeProfile;
  currentMonth: CurrentMonthCard;
  historySummary: HistorySummaryCard;
  i983Status: I983StatusCard | null;
  trainerContext: TrainerContextCard | null;
  timeline: EvaluationTimelineEntry[];
}

export interface HomeAggregate {
  activeEvaluees: number;
  evaluationsThisMonth: number;
  pendingAcknowledgments: number;
}

export interface EvalueePanelContext {
  lifecycleId: string;
  internName: string | null;
  employeeId: string | null;
  technology: string | null;
  workAuthType: string | null;
  monthsInProgram: number;
  lastEvaluationAt: string | null;
  lastEvaluationStatus: string | null;
  isStemOpt: boolean;
}

export interface RightPanelResponse {
  monthYearLabel: string;
  homeAggregate: HomeAggregate | null;
  evalueeContext: EvalueePanelContext | null;
}
