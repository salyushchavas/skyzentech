// Manager Phase 1 — TS mirrors of ManagerDtos. Read-only payloads:
// Executive Overview headline + the filterable applicant pipeline.

export interface CallerView {
  userId: string;
  fullName: string;
  email: string;
  role: 'MANAGER' | 'SUPER_ADMIN';
  superAdmin: boolean;
}

export interface HeadlineBuckets {
  totalApplications: number;
  applicantsInPipeline: number;
  offersAwaitingSignature: number;
  prospectiveNewHires: number;
  activeInterns: number;
  inactiveInterns: number;
}

export interface ConversionKpis {
  shortlistConversionPct: number | null;
  interviewCompletionPct: number | null;
  offerSignaturePct: number | null;
  offersPendingOver7Days: number;
}

export interface OverviewResponse {
  caller: CallerView;
  lifecycleCounts: Record<string, number>;
  applicationCounts: Record<string, number>;
  buckets: HeadlineBuckets;
  kpis: ConversionKpis;
  generatedAt: string;
}

export interface PipelineRow {
  applicationId: string;
  applicantName: string | null;
  applicantId: string | null;
  applicantEmail: string | null;
  jobTitle: string | null;
  jobType: string | null;
  technology: string | null;
  stage: string;
  latestInterviewStatus: string | null;
  lastDecisionAt: string | null;
  ageDays: number;
  ermOwnerId: string | null;
  ermOwnerName: string | null;
  expectedStartDate: string | null;
}

export interface ErmOwnerOption {
  userId: string;
  fullName: string;
}

export interface FilterOptions {
  stages: string[];
  jobTypes: string[];
  ermOwners: ErmOwnerOption[];
}

export interface PipelineResponse {
  items: PipelineRow[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  filters: FilterOptions;
}

// ── Onboarding Health (Phase 2) ──────────────────────────────────────────

export interface DocumentSummary {
  packetStatus: string | null;
  totalTasks: number;
  acceptedTasks: number;
  submittedTasks: number;
  pendingTasks: number;
  rejectedTasks: number;
  waivedTasks: number;
  hasRejected: boolean;
  lastReviewedAt: string | null;
}

export interface ComplianceSummary {
  i9Status: string | null;
  i9Section2DueDate: string | null;
  i9Overdue: boolean;
  everifyStatus: string | null;
  everifyDueBy: string | null;
  everifyOverdue: boolean;
  workAuthValidUntil: string | null;
  workAuthExpiringSoon: boolean;
}

export interface OnboardingRow {
  internLifecycleId: string;
  internUserId: string;
  internName: string | null;
  internEmail: string | null;
  employeeId: string | null;
  workAuthType: string | null;
  lifecycleStatus: string;
  tentativeStartDate: string | null;
  daysUntilStart: number | null;
  startDateAtRisk: boolean;
  documents: DocumentSummary | null;
  compliance: ComplianceSummary | null;
  ermOwnerId: string | null;
  ermOwnerName: string | null;
  managerId: string | null;
  managerName: string | null;
}

export interface OnboardingResponse {
  items: OnboardingRow[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface OnboardingSummary {
  offersAwaitingSignature: number;
  newHiresOnboarding: number;
  onboardingAccepted: number;
  i9Overdue: number;
  everifyOverdue: number;
  startDateAtRisk: number;
}

export interface OnboardingFilterOptions {
  lifecycleStages: string[];
  workAuthTypes: string[];
  ermOwners: ErmOwnerOption[];
}
