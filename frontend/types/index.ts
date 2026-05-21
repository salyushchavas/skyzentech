// Shared frontend types — populated as the API surface grows.

export type Uuid = string;

export type IsoDateTime = string;

export type ApiError = {
  message: string;
  status: number;
  details?: unknown;
};

export type UserRole =
  | 'CANDIDATE'
  | 'RECRUITER'
  | 'ERM'
  | 'HR_COMPLIANCE'
  | 'TECHNICAL_EVALUATOR'
  | 'ADMIN';

export interface User {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  roles: UserRole[];
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  fullName: string;
  roles: UserRole[];
}

// === Job postings ============================================================

export type EmploymentType = 'INTERNSHIP' | 'CONTRACT' | 'FULL_TIME';

export type JobPostingStatus = 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED';

export interface JobPostingResponse {
  id: Uuid;
  slug: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  employmentType: EmploymentType;
  status: JobPostingStatus;
  entityName?: string;
  publishedAt?: IsoDateTime;
  createdAt: IsoDateTime;
}

// Paged envelope returned by every list endpoint. The backend returns a custom
// PagedResponse<T> instead of Spring's PageImpl (deprecated for serialization
// in Spring Boot 3 — see backend/.../dto/common/PagedResponse.java). Field
// shape mirrors PagedAuditLogResponse from D2 for cross-endpoint consistency.
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// === Applications ============================================================

export type ApplicationStatus =
  | 'APPLIED'
  | 'SHORTLISTED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEWED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'LAPSED'
  | 'NO_SHOW';

export interface ApplicationResponse {
  id: Uuid;
  candidateName?: string;
  candidateEmail?: string;
  jobPostingTitle?: string;
  jobPostingId: Uuid;
  resumeId?: Uuid;
  resumeFileName?: string;
  status: ApplicationStatus;
  appliedAt: IsoDateTime;
  statusUpdatedAt?: IsoDateTime;
  recruiterNotes?: string;
  /** Recruiter's 1-5 rating from the review screen (nullable). */
  recruiterRating?: number;
}

export interface RecruiterDecisionRequest {
  rating?: number;
  note?: string;
}

// === Resumes =================================================================

export interface ResumeResponse {
  id: Uuid;
  fileName: string;
  fileSize: number;
  contentType: string;
  isDefault: boolean;
  createdAt: IsoDateTime;
}

// === Interviews ==============================================================

export type InterviewType =
  | 'INITIAL_SCREEN'
  | 'TECHNICAL'
  | 'BEHAVIORAL'
  | 'CULTURE_FIT'
  | 'FINAL_ROUND';

export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type InterviewRecommendation =
  | 'STRONG_HIRE'
  | 'HIRE'
  | 'NO_HIRE'
  | 'STRONG_NO_HIRE';

export interface InterviewResponse {
  id: Uuid;
  applicationId: Uuid;
  applicationStatus?: ApplicationStatus;
  candidateName?: string;
  candidateEmail?: string;
  jobPostingTitle?: string;
  interviewerName?: string;
  interviewerId?: Uuid;
  scheduledAt: IsoDateTime;
  durationMinutes: number;
  type: InterviewType;
  status: InterviewStatus;
  meetingUrl?: string;
  candidateNotes?: string;
  feedbackOverallRating?: number;
  feedbackTechnicalRating?: number;
  feedbackCommunicationRating?: number;
  feedbackStrengths?: string;
  feedbackConcerns?: string;
  feedbackRecommendation?: InterviewRecommendation;
  feedbackSubmittedAt?: IsoDateTime;
  feedbackSubmittedByName?: string;
  createdAt: IsoDateTime;
  createdByName?: string;
}

export interface InterviewSummaryResponse {
  id: Uuid;
  candidateName?: string;
  jobPostingTitle?: string;
  interviewerName?: string;
  scheduledAt: IsoDateTime;
  durationMinutes: number;
  type: InterviewType;
  status: InterviewStatus;
  hasFeedback: boolean;
}

export interface CandidateInterviewResponse {
  id: Uuid;
  scheduledAt: IsoDateTime;
  durationMinutes: number;
  type: InterviewType;
  status: InterviewStatus;
  meetingUrl?: string;
  candidateNotes?: string;
  interviewerName?: string;
}

export interface ScheduleInterviewRequest {
  applicationId: Uuid;
  interviewerId: Uuid;
  scheduledAt: IsoDateTime;
  durationMinutes: number;
  type: InterviewType;
  meetingUrl?: string;
  candidateNotes?: string;
}

export interface SubmitFeedbackRequest {
  overallRating: number;
  technicalRating?: number;
  communicationRating?: number;
  strengths?: string;
  concerns?: string;
  recommendation: InterviewRecommendation;
}

// === Offers ==================================================================

export type CompensationFrequency = 'HOURLY' | 'MONTHLY' | 'YEARLY';

export type OfferStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REVOKED';

export interface OfferResponse {
  id: Uuid;
  applicationId: Uuid;
  candidateName?: string;
  candidateEmail?: string;
  candidateId?: Uuid;
  jobPostingTitle?: string;
  jobPostingId?: Uuid;
  entityName?: string;
  entityId?: Uuid;
  compensationAmount: number | string;
  compensationFrequency: CompensationFrequency;
  compensationCurrency: string;
  startDate: string;
  expectedEndDate?: string;
  expiresAt: IsoDateTime;
  status: OfferStatus;
  additionalTerms?: string;
  letterContent: string;
  declineReason?: string;
  sentAt?: IsoDateTime;
  respondedAt?: IsoDateTime;
  revokedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  createdByName?: string;
  updatedAt: IsoDateTime;
  /** Server-side computed. Jackson serializes the boolean field as "expired". */
  expired: boolean;
}

export interface OfferSummaryResponse {
  id: Uuid;
  candidateName?: string;
  jobPostingTitle?: string;
  entityName?: string;
  compensationAmount: number | string;
  compensationFrequency: CompensationFrequency;
  startDate: string;
  expiresAt: IsoDateTime;
  status: OfferStatus;
  createdAt: IsoDateTime;
}

export interface CandidateOfferResponse {
  id: Uuid;
  jobPostingTitle?: string;
  entityName?: string;
  compensationAmount: number | string;
  compensationFrequency: CompensationFrequency;
  compensationCurrency: string;
  startDate: string;
  expectedEndDate?: string;
  expiresAt: IsoDateTime;
  status: OfferStatus;
  additionalTerms?: string;
  letterContent: string;
  sentAt?: IsoDateTime;
  respondedAt?: IsoDateTime;
  expired: boolean;
}

export interface CreateOfferRequest {
  applicationId: Uuid;
  compensationAmount: number;
  compensationFrequency: CompensationFrequency;
  compensationCurrency?: string;
  startDate: string;
  expectedEndDate?: string;
  daysToRespond: number;
  additionalTerms?: string;
}

export interface UpdateOfferRequest {
  compensationAmount?: number;
  compensationFrequency?: CompensationFrequency;
  compensationCurrency?: string;
  startDate?: string;
  expectedEndDate?: string;
  daysToRespond?: number;
  additionalTerms?: string;
  letterContent?: string;
}

export interface DeclineOfferRequest {
  reason?: string;
}

// === Onboarding ==============================================================

export type OnboardingCategory =
  | 'PAPERWORK'
  | 'COMPLIANCE'
  | 'SETUP'
  | 'INTRODUCTION';

export type OnboardingTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'NOT_APPLICABLE';

export interface OnboardingTaskResponse {
  id: Uuid;
  taskKey: string;
  title: string;
  description?: string;
  category: OnboardingCategory;
  status: OnboardingTaskStatus;
  sortOrder: number;
  /** LocalDate ISO string, e.g. "2026-05-24" (no time component). */
  dueDate?: string;
  linkUrl?: string;
  completedAt?: IsoDateTime;
  completedByName?: string;
  offerId?: Uuid;
  applicationId?: Uuid;
  /** Jackson serializes the boolean isOverdue() getter as "overdue". */
  overdue: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface OnboardingSummaryResponse {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  progressPercent: number;
  nextDueTask?: OnboardingTaskResponse | null;
}

export interface UpdateTaskStatusRequest {
  status: OnboardingTaskStatus;
}

// === Form I-9 ================================================================

export type I9Status =
  | 'NOT_STARTED'
  | 'SECTION_1_COMPLETE'
  | 'COMPLETED'
  | 'REOPENED';

export type CitizenshipStatus =
  | 'US_CITIZEN'
  | 'NONCITIZEN_NATIONAL'
  | 'LAWFUL_PERMANENT_RESIDENT'
  | 'ALIEN_AUTHORIZED_TO_WORK';

export interface I9FormResponse {
  // Identity
  id: Uuid;
  candidateId?: Uuid;
  candidateName?: string;
  candidateEmail?: string;
  status: I9Status;

  // Section 1
  lastName?: string;
  firstName?: string;
  middleInitial?: string;
  otherLastNamesUsed?: string;
  addressStreet?: string;
  addressAptNumber?: string;
  addressCity?: string;
  addressState?: string;
  addressZipCode?: string;
  /** LocalDate ISO string, e.g. "2002-05-23". */
  dateOfBirth?: string;
  ssn?: string;
  email?: string;
  phoneNumber?: string;
  citizenshipStatus?: CitizenshipStatus;
  alienRegistrationNumber?: string;
  foreignPassportNumber?: string;
  foreignPassportCountry?: string;
  workAuthExpirationDate?: string;
  preparerTranslatorUsed?: boolean;
  section1SignedAt?: IsoDateTime;
  section1SignedByName?: string;

  // Section 2
  firstDayOfEmployment?: string;
  listATitle?: string;
  listAIssuingAuthority?: string;
  listADocumentNumber?: string;
  listAExpirationDate?: string;
  listBTitle?: string;
  listBIssuingAuthority?: string;
  listBDocumentNumber?: string;
  listBExpirationDate?: string;
  listCTitle?: string;
  listCIssuingAuthority?: string;
  listCDocumentNumber?: string;
  additionalInformation?: string;
  employerName?: string;
  employerTitle?: string;
  businessOrganizationName?: string;
  businessAddress?: string;
  section2SignedAt?: IsoDateTime;
  section2SignedByName?: string;

  // Computed
  section2DueDate?: string;
  /** Jackson serializes the boolean isOverdue() getter as "overdue". */
  overdue: boolean;
  daysUntilDue?: number;

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface I9SummaryResponse {
  id: Uuid;
  candidateId?: Uuid;
  candidateName?: string;
  candidateEmail?: string;
  jobPostingTitle?: string;
  status: I9Status;
  firstDayOfEmployment?: string;
  section2DueDate?: string;
  overdue: boolean;
  daysUntilDue?: number;
}

/**
 * Section 1 wire payload.
 *
 * Note: the backend DTO field is named `draft` (renamed from `isDraft` to dodge
 * a Lombok/Jackson naming collision — see B1 backend doc). So the JSON wire
 * name is "draft", not "isDraft".
 */
export interface Section1Request {
  lastName?: string;
  firstName?: string;
  middleInitial?: string;
  otherLastNamesUsed?: string;
  addressStreet?: string;
  addressAptNumber?: string;
  addressCity?: string;
  addressState?: string;
  addressZipCode?: string;
  dateOfBirth?: string;
  ssn?: string;
  email?: string;
  phoneNumber?: string;
  citizenshipStatus?: CitizenshipStatus;
  alienRegistrationNumber?: string;
  foreignPassportNumber?: string;
  foreignPassportCountry?: string;
  workAuthExpirationDate?: string;
  preparerTranslatorUsed?: boolean;
  draft: boolean;
}

/** Section 2 wire payload (same `draft` convention as Section 1). */
export interface Section2Request {
  firstDayOfEmployment?: string;
  listATitle?: string;
  listAIssuingAuthority?: string;
  listADocumentNumber?: string;
  listAExpirationDate?: string;
  listBTitle?: string;
  listBIssuingAuthority?: string;
  listBDocumentNumber?: string;
  listBExpirationDate?: string;
  listCTitle?: string;
  listCIssuingAuthority?: string;
  listCDocumentNumber?: string;
  additionalInformation?: string;
  employerName?: string;
  employerTitle?: string;
  businessOrganizationName?: string;
  businessAddress?: string;
  draft: boolean;
}

export interface I9HistoryEntryResponse {
  auditId: Uuid;
  timestamp: IsoDateTime;
  action: string;
  performedByName?: string;
  performedByRole?: string;
  summary: string;
}

export interface ReopenI9Request {
  reason: string;
}

// === E-Verify ================================================================

export type EVerifyStatus =
  | 'PENDING_SUBMISSION'
  | 'OPEN'
  | 'EMPLOYMENT_AUTHORIZED'
  | 'TENTATIVE_NONCONFIRMATION'
  | 'FINAL_NONCONFIRMATION'
  | 'CLOSED';

export type EVerifyClosureReason =
  | 'SUCCESSFUL'
  | 'EMPLOYEE_TERMINATED'
  | 'INVALID_QUERY'
  | 'OTHER';

export type PhotoMatchResult = 'MATCH' | 'NO_MATCH' | 'NOT_APPLICABLE';

export interface EVerifyCaseResponse {
  id: Uuid;
  i9FormId: Uuid;
  candidateName?: string;
  candidateEmail?: string;
  candidateId?: Uuid;
  caseNumber?: string;
  status: EVerifyStatus;
  closureReason?: EVerifyClosureReason;
  openedAt?: IsoDateTime;
  closedAt?: IsoDateTime;
  photoMatchRequired?: boolean;
  photoMatchResult?: PhotoMatchResult;
  additionalVerificationRequired?: boolean;
  notes?: string;
  daysOpen?: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  createdByName?: string;
}

export interface EVerifyCaseSummaryResponse {
  id: Uuid;
  i9FormId: Uuid;
  candidateName?: string;
  candidateEmail?: string;
  caseNumber?: string;
  status: EVerifyStatus;
  openedAt?: IsoDateTime;
  closedAt?: IsoDateTime;
  daysOpen?: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreateEVerifyCaseRequest {
  i9FormId: Uuid;
}

export interface UpdateEVerifyCaseRequest {
  caseNumber?: string;
  photoMatchRequired?: boolean;
  photoMatchResult?: PhotoMatchResult;
  additionalVerificationRequired?: boolean;
  notes?: string;
}

export interface UpdateEVerifyStatusRequest {
  status: EVerifyStatus;
  notes?: string;
}

export interface CloseEVerifyCaseRequest {
  closureReason: EVerifyClosureReason;
  notes?: string;
}

export interface EVerifyHistoryEntryResponse {
  auditId: Uuid;
  timestamp: IsoDateTime;
  action: string;
  performedByName?: string;
  performedByRole?: string;
  summary: string;
}

// === Form I-983 (STEM OPT Training Plan) =====================================

export type I983Status =
  | 'DRAFT'
  | 'COMPLETE'
  | 'SUBMITTED_TO_DSO'
  | 'DSO_APPROVED'
  | 'DSO_REJECTED'
  | 'AMENDMENT_REQUESTED';

export type DegreeLevel = 'BACHELORS' | 'MASTERS' | 'DOCTORATE';

export type DsoApprovalStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'AMENDMENT_REQUESTED';

export interface I983PlanResponse {
  id: Uuid;
  candidateId?: Uuid;
  candidateName?: string;
  candidateEmail?: string;
  applicationId?: Uuid;
  offerId?: Uuid;
  entityId?: Uuid;
  entityName?: string;
  status: I983Status;

  // Section 1
  studentLastName?: string;
  studentFirstName?: string;
  studentMiddleName?: string;
  sevisId?: string;
  uscisNumber?: string;
  studentEmail?: string;
  degreeAwarded?: string;
  degreeLevel?: DegreeLevel;
  universityName?: string;
  universityCipCode?: string;
  dateOfDegreeAward?: string;
  optStartDate?: string;
  optEndDate?: string;

  // Section 2
  employerName?: string;
  employerEin?: string;
  employerAddress?: string;
  employerWebsite?: string;
  employerNaicsCode?: string;
  employerNumberOfFullTimeEmployees?: number;
  employerOfficialName?: string;
  employerOfficialTitle?: string;
  employerOfficialEmail?: string;
  employerOfficialPhone?: string;

  // Section 3
  jobTitle?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  hoursPerWeek?: number;
  compensationAmount?: number | string;
  compensationFrequency?: CompensationFrequency;
  compensationCurrency?: string;
  supervisorName?: string;
  supervisorTitle?: string;
  supervisorEmail?: string;
  supervisorPhone?: string;

  // Section 4
  trainingProgramDescription?: string;
  howTrainingRelatesToDegree?: string;
  trainingGoalsAndObjectives?: string;
  performanceEvaluationMethod?: string;
  reportingRequirements?: string;
  skillsKnowledgeLearned?: string;
  resourcesEquipmentMaterials?: string;
  supervisorCommitments?: string;

  // Signatures
  employerSignedAt?: IsoDateTime;
  employerSignedByName?: string;
  employerSignedName?: string;
  studentSignedAt?: IsoDateTime;
  studentSignedName?: string;

  // DSO tracking
  dsoSubmittedAt?: IsoDateTime;
  dsoSubmittedByName?: string;
  dsoApprovalStatus: DsoApprovalStatus;
  dsoApprovalNotes?: string;
  dsoRespondedAt?: IsoDateTime;

  // Computed — Jackson serializes the boolean isFullySigned() getter as "fullySigned".
  fullySigned: boolean;
  daysSinceCreation?: number;
  daysOverdue?: number;

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  createdByName?: string;
}

export interface I983SummaryResponse {
  id: Uuid;
  candidateId?: Uuid;
  candidateName?: string;
  entityName?: string;
  jobTitle?: string;
  status: I983Status;
  dsoApprovalStatus: DsoApprovalStatus;
  /** Jackson serializes boolean isEmployerSigned() as "employerSigned". */
  employerSigned: boolean;
  /** Jackson serializes boolean isStudentSigned() as "studentSigned". */
  studentSigned: boolean;
  trainingStartDate?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreateI983Request {
  /** Optional when applicationId is provided — backend derives from the application. */
  candidateId?: Uuid;
  applicationId?: Uuid;
  offerId?: Uuid;
}

export interface UpdateI983Request {
  // Section 1
  studentLastName?: string;
  studentFirstName?: string;
  studentMiddleName?: string;
  sevisId?: string;
  uscisNumber?: string;
  studentEmail?: string;
  degreeAwarded?: string;
  degreeLevel?: DegreeLevel;
  universityName?: string;
  universityCipCode?: string;
  dateOfDegreeAward?: string;
  optStartDate?: string;
  optEndDate?: string;
  // Section 2
  employerName?: string;
  employerEin?: string;
  employerAddress?: string;
  employerWebsite?: string;
  employerNaicsCode?: string;
  employerNumberOfFullTimeEmployees?: number;
  employerOfficialName?: string;
  employerOfficialTitle?: string;
  employerOfficialEmail?: string;
  employerOfficialPhone?: string;
  // Section 3
  jobTitle?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  hoursPerWeek?: number;
  compensationAmount?: number;
  compensationFrequency?: CompensationFrequency;
  compensationCurrency?: string;
  supervisorName?: string;
  supervisorTitle?: string;
  supervisorEmail?: string;
  supervisorPhone?: string;
  // Section 4
  trainingProgramDescription?: string;
  howTrainingRelatesToDegree?: string;
  trainingGoalsAndObjectives?: string;
  performanceEvaluationMethod?: string;
  reportingRequirements?: string;
  skillsKnowledgeLearned?: string;
  resourcesEquipmentMaterials?: string;
  supervisorCommitments?: string;
}

export interface SubmitToDsoRequest {
  submissionNotes?: string;
}

export interface DsoResponseRequest {
  approvalStatus: 'APPROVED' | 'REJECTED' | 'AMENDMENT_REQUESTED';
  notes?: string;
}

export interface I983HistoryEntryResponse {
  auditId: Uuid;
  timestamp: IsoDateTime;
  action: string;
  performedByName?: string;
  performedByRole?: string;
  summary: string;
}

// === Document Vault ==========================================================

export type DocumentType = 'I9' | 'I983' | 'OFFER' | 'RESUME';

export type DocumentStatusColor =
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'gray'
  | 'purple'
  | 'orange';

export interface DocumentRecordResponse {
  id: Uuid;
  type: DocumentType;
  title: string;
  candidateId?: Uuid;
  candidateName?: string;
  candidateEmail?: string;
  entityName?: string;
  status?: string;
  statusLabel?: string;
  statusColor?: DocumentStatusColor;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  retentionPolicyText?: string;
  linkUrl?: string;
  /** Jackson serializes the boolean isImmutable() as "immutable". */
  immutable: boolean;
  /** Jackson serializes the boolean isHasAuditLog() as "hasAuditLog". */
  hasAuditLog: boolean;
}

// === Compliance Overview =====================================================

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface I9Stats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
}

export interface I983Stats {
  total: number;
  draft: number;
  complete: number;
  submittedToDso: number;
  approved: number;
  rejected: number;
  amendment: number;
}

export interface EverifyStats {
  total: number;
  pendingSubmission: number;
  open: number;
  tnc: number;
  authorized: number;
  closed: number;
}

export interface OfferStats {
  totalActive: number;
  pending: number;
  accepted: number;
  declined: number;
}

export interface ComplianceStats {
  i9: I9Stats;
  i983: I983Stats;
  everify: EverifyStats;
  offers: OfferStats;
}

export interface ComplianceAlert {
  severity: AlertSeverity;
  title: string;
  description?: string;
  linkUrl?: string;
  count?: number;
}

export interface UpcomingDeadline {
  label: string;
  dueDate: string;
  daysUntilDue?: number;
  candidateName?: string;
  linkUrl?: string;
}

export interface RecentAction {
  timestamp: IsoDateTime;
  summary: string;
  performedByName?: string;
  performedByRole?: string;
  entityType?: string;
  entityLinkUrl?: string;
}

export interface ComplianceOverviewResponse {
  stats: ComplianceStats;
  alerts: ComplianceAlert[];
  upcomingDeadlines: UpcomingDeadline[];
  recentActions: RecentAction[];
}
