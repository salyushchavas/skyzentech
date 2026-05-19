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

// Spring Page<T> envelope returned by the paginated list endpoints.
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
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
