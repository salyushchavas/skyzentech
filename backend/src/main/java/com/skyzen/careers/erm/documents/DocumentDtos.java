package com.skyzen.careers.erm.documents;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** ERM Phase 8 — DTO surface for the document-template library +
 *  per-intern packet workflow + intern document page. */
public final class DocumentDtos {

    private DocumentDtos() {}

    // ── Templates ────────────────────────────────────────────────────────

    public record DocumentTemplateDto(
            UUID id,
            String title,
            String description,
            String category,
            String fileKind,
            String sensitivity,
            Integer version,
            UUID templateFileId,
            String templateFileName,
            Long templateFileSize,
            UUID previousVersionFileId,
            Boolean isActive,
            String instructions,
            UUID createdById,
            String createdByName,
            Instant createdAt,
            Instant updatedAt,
            long usageCount               // # active packets/tasks referencing this template
    ) {}

    public record DocumentTemplatePage(
            List<DocumentTemplateDto> items,
            int page, int pageSize, long totalElements, int totalPages
    ) {}

    public record CreateTemplateRequest(
            String title, String description, String category, String fileKind,
            String sensitivity, String instructions
    ) {}

    public record UpdateTemplateRequest(
            String description, String category, String fileKind,
            String sensitivity, String instructions
    ) {}

    // ── Packets ──────────────────────────────────────────────────────────

    public record AssignPacketRequest(
            UUID internLifecycleId,
            List<UUID> selectedTemplateIds,
            String customInstructions,
            Map<UUID, String> perTemplateInstructions
    ) {}

    public record DocumentPacketRow(
            UUID packetId,
            UUID internLifecycleId,
            UUID internUserId,
            String internName,
            String internEmployeeId,
            String status,
            int totalTasks,
            int acceptedTasks,
            int submittedTasks,
            int pendingTasks,
            int rejectedTasks,
            int waivedTasks,
            Instant assignedAt,
            Instant completedAt
    ) {}

    public record DocumentPacketListPage(
            List<DocumentPacketRow> items,
            int page, int pageSize, long totalElements, int totalPages
    ) {}

    public record TaskSummary(
            UUID taskId,
            UUID templateId,
            String templateTitle,
            String category,
            String status,
            Integer version,
            Instant submittedAt,
            Instant reviewedAt,
            String reviewReasonCode,
            String reviewComments,
            UUID uploadedFileId,
            String uploadedFileName,
            String taskInstructions
    ) {}

    public record DocumentPacketDetail(
            UUID packetId,
            UUID internLifecycleId,
            UUID internUserId,
            String internName,
            String internEmail,
            String internEmployeeId,
            String status,
            String customInstructions,
            Instant assignedAt,
            Instant firstSubmissionAt,
            Instant allSubmittedAt,
            Instant completedAt,
            Instant cancelledAt,
            String cancellationReason,
            List<TaskSummary> tasks,
            boolean readyToClose
    ) {}

    // ── Review queue + task detail ───────────────────────────────────────

    public record DocumentTaskRow(
            UUID taskId,
            UUID packetId,
            UUID internLifecycleId,
            UUID internUserId,
            String internName,
            String templateTitle,
            String category,
            String status,
            Integer version,
            Instant submittedAt,
            long hoursWaiting
    ) {}

    public record DocumentTaskListPage(
            List<DocumentTaskRow> items,
            int page, int pageSize, long totalElements, int totalPages
    ) {}

    public record ReviewEventEntry(
            UUID id,
            UUID actorUserId,
            String actorName,
            String eventType,
            String previousStatus,
            String newStatus,
            String reasonCode,
            String comments,
            Instant createdAt
    ) {}

    public record DocumentTaskDetail(
            UUID taskId,
            UUID packetId,
            UUID templateId,
            String templateTitle,
            String category,
            String fileKind,
            String sensitivity,
            String status,
            Integer version,
            String taskInstructions,
            UUID templateSnapshotFileId,
            UUID uploadedFileId,
            String uploadedFileName,
            Long uploadedFileSize,
            String uploadedFileMime,
            Instant submittedAt,
            Instant reviewedAt,
            UUID reviewedById,
            String reviewedByName,
            String reviewReasonCode,
            String reviewComments,
            String internalNote,             // ERM-only — stripped from intern DTO
            UUID internLifecycleId,
            UUID internUserId,
            String internName,
            List<ReviewEventEntry> history
    ) {}

    public record ReviewTaskRequest(
            String decision,                 // ACCEPT | REJECT | RESEND_REQUEST
            String reasonCode,
            String reasonText,
            String ermComments,
            String internalNote
    ) {}

    public record BulkReviewRequest(
            List<UUID> taskIds,
            String decision,                 // ACCEPT only — bulk-reject requires per-task comments
            String reasonCode,
            String reasonText
    ) {}

    public record BulkReviewResult(
            int accepted,
            int skipped,
            List<BulkSkipReason> skippedReasons
    ) {}

    public record BulkSkipReason(UUID taskId, String reason) {}

    public record ReasonCodeOption(String code, String label, boolean requiresFreeText) {}

    public record ReasonCodeGroup(String family, List<ReasonCodeOption> options) {}

    // ── Intern-facing variants (no ERM-only fields) ──────────────────────

    public record InternTaskView(
            UUID taskId,
            UUID templateId,
            String templateTitle,
            String description,
            String category,
            String fileKind,
            String status,
            Integer version,
            String taskInstructions,
            UUID templateSnapshotFileId,
            Instant submittedAt,
            Instant reviewedAt,
            String reviewReasonCode,         // OK to expose — used to render "Reason: X" label
            String reviewComments            // shown verbatim
    ) {}

    public record InternPacketView(
            UUID packetId,
            String status,
            String customInstructions,
            Instant assignedAt,
            Instant completedAt,
            List<InternTaskView> tasks,
            int totalTasks,
            int acceptedTasks
    ) {}
}
