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
