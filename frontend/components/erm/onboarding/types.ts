// ERM Phase 5 — onboarding review DTO mirrors (kept in sync with
// ErmOnboardingDtos.java in the backend).

export type OnboardingItemStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'RESEND_REQUESTED';

export type PacketStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED';

export type ReviewDecision = 'ACCEPT' | 'REJECT' | 'RESEND';

export interface ReviewQueueRow {
  itemId: string;
  packetId: string;
  applicantUserId: string;
  applicantName: string | null;
  applicantId: string | null;
  applicantEmail: string | null;
  category: string;
  status: OnboardingItemStatus;
  required: boolean;
  submittedAt: string | null;
  lastReviewedAt: string | null;
  lastReviewReasonCode: string | null;
  reviewCount: number | null;
  daysWaiting: number | null;
}

export interface ReviewQueuePage {
  items: ReviewQueueRow[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface PacketRow {
  packetId: string;
  applicantUserId: string;
  applicantName: string | null;
  applicantId: string | null;
  packetStatus: PacketStatus;
  totalItems: number;
  acceptedItems: number;
  pendingReviewItems: number;
  rejectedItems: number;
  assignedAt: string | null;
  acceptedAt: string | null;
}

export interface PacketListPage {
  items: PacketRow[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface ItemSummary {
  itemId: string;
  category: string;
  status: OnboardingItemStatus;
  required: boolean;
  submittedAt: string | null;
  lastReviewedAt: string | null;
  lastReviewReasonCode: string | null;
  reviewCount: number | null;
}

export interface PacketDetail {
  packetId: string;
  applicantUserId: string;
  applicantName: string | null;
  applicantId: string | null;
  applicantEmail: string | null;
  packetStatus: PacketStatus;
  assignedAt: string | null;
  acceptedAt: string | null;
  items: ItemSummary[];
}

export interface ReviewLogEntry {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  decision: string;
  reasonCode: string | null;
  reasonText: string | null;
  previousStatus: string;
  newStatus: string;
  ermCommentsSnapshot: string | null;
  createdAt: string;
}

export interface ItemDetail {
  itemId: string;
  packetId: string;
  applicantUserId: string | null;
  applicantName: string | null;
  applicantEmail: string | null;
  category: string;
  status: OnboardingItemStatus;
  required: boolean;
  submittedAt: string | null;
  documentId: string | null;
  ermComments: string | null;
  internalNotes: string | null;
  lastReviewedAt: string | null;
  lastReviewedById: string | null;
  lastReviewReasonCode: string | null;
  lastReviewReasonText: string | null;
  reviewCount: number | null;
  formData: Record<string, unknown>;
  history: ReviewLogEntry[];
}

export interface ReviewRequest {
  decision: ReviewDecision;
  reasonCode?: string;
  reasonText?: string;
  ermComments?: string;
  internalNotes?: string;
}

export interface ReasonCodeOption {
  code: string;
  label: string;
  requiresFreeText: boolean;
}

export interface ReasonCodeGroup {
  family: string;
  options: ReasonCodeOption[];
}

export const CATEGORY_LABEL: Record<string, string> = {
  W4: 'W-4 Tax Form',
  I9: 'I-9 Section 1',
  ACH: 'ACH Direct Deposit',
  EMERGENCY_CONTACT: 'Emergency Contact',
  HANDBOOK_ACK: 'Handbook Acknowledgment',
  I983: 'I-983 Training Plan',
};
