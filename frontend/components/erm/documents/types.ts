// ERM Phase 8 — DTO mirrors of the Java records in
// com.skyzen.careers.erm.documents.DocumentDtos. Field names match the JSON
// keys (which match the Java record component names).

export type DocumentTemplateDto = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  fileKind: string | null;
  sensitivity: string | null;
  version: number;
  templateFileId: string | null;
  templateFileName: string | null;
  templateFileSize: number | null;
  previousVersionFileId: string | null;
  isActive: boolean;
  instructions: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
};

export type DocumentTemplatePage = {
  items: DocumentTemplateDto[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
};

export type PacketStatus =
  | 'DRAFT'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ALL_SUBMITTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'RESEND_REQUESTED'
  | 'WAIVED';

export type DocumentPacketRow = {
  packetId: string;
  internLifecycleId: string;
  internUserId: string | null;
  internName: string | null;
  internEmployeeId: string | null;
  status: PacketStatus;
  totalTasks: number;
  acceptedTasks: number;
  submittedTasks: number;
  pendingTasks: number;
  rejectedTasks: number;
  waivedTasks: number;
  assignedAt: string | null;
  completedAt: string | null;
};

export type DocumentPacketListPage = {
  items: DocumentPacketRow[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
};

export type TaskSummary = {
  taskId: string;
  templateId: string;
  templateTitle: string;
  category: string | null;
  status: TaskStatus;
  version: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewReasonCode: string | null;
  reviewComments: string | null;
  uploadedFileId: string | null;
  uploadedFileName: string | null;
  taskInstructions: string | null;
};

export type DocumentPacketDetail = {
  packetId: string;
  internLifecycleId: string;
  internUserId: string | null;
  internName: string | null;
  internEmail: string | null;
  internEmployeeId: string | null;
  status: PacketStatus;
  customInstructions: string | null;
  assignedAt: string | null;
  firstSubmissionAt: string | null;
  allSubmittedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  tasks: TaskSummary[];
  readyToClose: boolean;
};

export type DocumentTaskRow = {
  taskId: string;
  packetId: string;
  internLifecycleId: string | null;
  internUserId: string | null;
  internName: string | null;
  templateTitle: string;
  category: string | null;
  status: TaskStatus;
  version: number | null;
  submittedAt: string | null;
  hoursWaiting: number;
};

export type DocumentTaskListPage = {
  items: DocumentTaskRow[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
};

export type ReviewEventEntry = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  eventType: string;
  previousStatus: string | null;
  newStatus: string | null;
  reasonCode: string | null;
  comments: string | null;
  createdAt: string;
};

export type DocumentTaskDetail = {
  taskId: string;
  packetId: string;
  templateId: string;
  templateTitle: string;
  category: string | null;
  fileKind: string | null;
  sensitivity: string | null;
  status: TaskStatus;
  version: number | null;
  taskInstructions: string | null;
  templateSnapshotFileId: string | null;
  uploadedFileId: string | null;
  uploadedFileName: string | null;
  uploadedFileSize: number | null;
  uploadedFileMime: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewReasonCode: string | null;
  reviewComments: string | null;
  internalNote: string | null;
  internLifecycleId: string | null;
  internUserId: string | null;
  internName: string | null;
  history: ReviewEventEntry[];
};

export type ReasonCodeOption = {
  code: string;
  label: string;
  requiresFreeText: boolean;
};

export type ReasonCodeGroup = {
  family: string;
  options: ReasonCodeOption[];
};

export type AssignPacketRequest = {
  internLifecycleId: string;
  selectedTemplateIds: string[];
  customInstructions?: string | null;
  perTemplateInstructions?: Record<string, string> | null;
};

export type ReviewTaskRequest = {
  decision: 'ACCEPT' | 'REJECT' | 'RESEND_REQUEST';
  reasonCode?: string | null;
  reasonText?: string | null;
  ermComments?: string | null;
  internalNote?: string | null;
};

export type BulkReviewRequest = {
  taskIds: string[];
  decision: 'ACCEPT';
  reasonCode?: string | null;
  reasonText?: string | null;
};

export type BulkReviewResult = {
  accepted: number;
  skipped: number;
  skippedReasons: { taskId: string; reason: string }[];
};

// Intern-facing variants — match InternTaskView / InternPacketView records.

export type InternTaskView = {
  taskId: string;
  templateId: string;
  templateTitle: string;
  description: string | null;
  category: string | null;
  fileKind: string | null;
  status: TaskStatus;
  version: number | null;
  taskInstructions: string | null;
  templateSnapshotFileId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewReasonCode: string | null;
  reviewComments: string | null;
};

export type InternPacketView = {
  packetId: string;
  status: PacketStatus;
  customInstructions: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  tasks: InternTaskView[];
  totalTasks: number;
  acceptedTasks: number;
};
