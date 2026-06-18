// Mirrors com.skyzen.careers.manager.hire.ManagerHireApprovalDtos.
// Single source of truth for the Hire Approvals queue + detail.

export type HireApprovalRow = {
  interviewId: string;
  applicationId: string | null;
  candidateUserId: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  jobTitle: string | null;
  technology: string | null;
  scorecardSubmittedAt: string | null;
  hoursWaiting: number;
  technicalScore: number | null;
  communicationScore: number | null;
  culturalFitScore: number | null;
  overallRecommendation: string | null;
};

export type HireApprovalListPage = {
  items: HireApprovalRow[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
};

export type HireApprovalDetail = {
  interviewId: string;
  applicationId: string | null;
  candidateUserId: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  jobTitle: string | null;
  technology: string | null;
  interviewScheduledAt: string | null;
  scorecardSubmittedAt: string | null;
  scorecardSubmittedByName: string | null;
  technicalScore: number | null;
  communicationScore: number | null;
  culturalFitScore: number | null;
  overallRecommendation: string | null;
  internalNotes: string | null;
  applicantVisibleNotes: string | null;
  managerHireDecision: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  managerHireDecisionAt: string | null;
  managerHireDecisionNote: string | null;
  /** Future-phase placeholder. Null today; the detail page renders a
   *  "Recording will appear here once the integration lands" card. */
  zoomRecordingUrl: string | null;
};

export type HireApprovalDecisionRequest = {
  note?: string | null;
};
