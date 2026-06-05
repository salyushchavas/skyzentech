package com.skyzen.careers.erm.onboarding;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** ERM Phase 5 — DTO surface for the Onboarding Document Review queue. */
public final class ErmOnboardingDtos {

    private ErmOnboardingDtos() {}

    public record ReviewQueueRow(
            UUID itemId,
            UUID packetId,
            UUID applicantUserId,
            String applicantName,
            String applicantId,
            String applicantEmail,
            String category,
            String status,
            Boolean required,
            Instant submittedAt,
            Instant lastReviewedAt,
            String lastReviewReasonCode,
            Integer reviewCount,
            Integer daysWaiting
    ) {}

    public record ReviewQueuePage(
            List<ReviewQueueRow> items,
            int page,
            int pageSize,
            long totalElements,
            int totalPages
    ) {}

    public record PacketRow(
            UUID packetId,
            UUID applicantUserId,
            String applicantName,
            String applicantId,
            String packetStatus,
            int totalItems,
            int acceptedItems,
            int pendingReviewItems,
            int rejectedItems,
            Instant assignedAt,
            Instant acceptedAt
    ) {}

    public record PacketListPage(
            List<PacketRow> items,
            int page,
            int pageSize,
            long totalElements,
            int totalPages
    ) {}

    public record PacketDetail(
            UUID packetId,
            UUID applicantUserId,
            String applicantName,
            String applicantId,
            String applicantEmail,
            String packetStatus,
            Instant assignedAt,
            Instant acceptedAt,
            List<ItemSummary> items
    ) {}

    public record ItemSummary(
            UUID itemId,
            String category,
            String status,
            Boolean required,
            Instant submittedAt,
            Instant lastReviewedAt,
            String lastReviewReasonCode,
            Integer reviewCount
    ) {}

    /** Full detail including decrypted form data (audit-logged via the
     *  intern OnboardingService.getItemFormData call). */
    public record ItemDetail(
            UUID itemId,
            UUID packetId,
            UUID applicantUserId,
            String applicantName,
            String applicantEmail,
            String category,
            String status,
            Boolean required,
            Instant submittedAt,
            UUID documentId,
            String ermComments,
            String internalNotes,           // ERM-only
            Instant lastReviewedAt,
            UUID lastReviewedById,
            String lastReviewReasonCode,
            String lastReviewReasonText,    // ERM-only
            Integer reviewCount,
            Map<String, Object> formData,
            List<ReviewLogEntry> history
    ) {}

    public record ReviewLogEntry(
            UUID id,
            UUID actorUserId,
            String actorName,
            String decision,
            String reasonCode,
            String reasonText,              // ERM-only
            String previousStatus,
            String newStatus,
            String ermCommentsSnapshot,
            Instant createdAt
    ) {}

    public record ReviewRequest(
            String decision,                // ACCEPT | REJECT | RESEND
            String reasonCode,
            String reasonText,              // optional unless reasonCode requires it
            String ermComments,             // surfaced to applicant on REJECT/RESEND
            String internalNotes            // optional ERM-only
    ) {}

    public record BulkReviewRequest(
            List<UUID> itemIds,
            String decision,                // ACCEPT only — bulk-reject would need per-item comments
            String reasonCode,              // typically null for bulk-ACCEPT
            String reasonText
    ) {}

    public record BulkReviewResult(
            int accepted,
            int skipped,
            List<BulkSkipReason> skippedReasons
    ) {}

    public record BulkSkipReason(UUID itemId, String reason) {}

    public record InternalNoteRequest(String internalNotes) {}

    public record ReasonCodeOption(String code, String label, boolean requiresFreeText) {}

    public record ReasonCodeGroup(String family, List<ReasonCodeOption> options) {}
}
