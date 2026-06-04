package com.skyzen.careers.erm.application;

import com.skyzen.careers.enums.ApplicationStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * ERM Phase 2 — DTO surface for the application inbox + decision flow.
 * Records grouped here to keep the package light; the service maps
 * entities → these.
 */
public final class ErmApplicationDtos {

    private ErmApplicationDtos() {}

    public record ErmApplicationRow(
            UUID applicationId,
            String applicantId,
            String applicantName,
            String applicantEmail,
            UUID jobId,
            String jobTitle,
            String jobType,
            String technology,
            ApplicationStatus stage,
            Instant lastDecisionAt,
            long ageDays,
            String workAuthType,
            String workAuthValidUntil,
            UUID ermOwnerId,
            String ermOwnerName,
            boolean hasResume,
            boolean urgentFlag
    ) {}

    public record ErmApplicationListPage(
            List<ErmApplicationRow> items,
            int page,
            int pageSize,
            long totalElements,
            int totalPages
    ) {}

    public record ErmApplicationDetail(
            ApplicationView application,
            ApplicantView applicant,
            ApplicantProfileView applicantProfile,
            ResumeView resume,
            JobView job,
            List<DecisionLogEntry> decisionHistory,
            AvailableActions availableActions
    ) {}

    public record ApplicationView(
            UUID id,
            ApplicationStatus stage,
            Instant appliedAt,
            Instant statusUpdatedAt,
            UUID ermOwnerId,
            String ermOwnerName,
            String internalNotes,
            String lastDecisionReasonCode,
            String lastDecisionReasonText,
            Instant lastDecisionAt,
            UUID lastDecisionById,
            String lastDecisionByName,
            String infoRequestedFieldsCsv,
            Instant infoRequestedAt,
            String statementOfInterest,
            String applicantVisibleFeedback
    ) {}

    public record ApplicantView(
            UUID userId,
            String firstName,
            String lastName,
            String email,
            String phone,
            String applicantId,
            String employeeId,
            Boolean emailVerified
    ) {}

    public record ApplicantProfileView(
            String education,
            String school,
            String degree,
            String skillset,
            String workAuthType,
            Boolean authorizedToWork,
            Boolean sponsorshipNeeded,
            String workAuthValidUntil,
            String statementOfInterest
    ) {}

    public record ResumeView(
            UUID documentId,
            String fileName,
            Long fileSize,
            String mimeType,
            String downloadUrl
    ) {}

    public record JobView(
            UUID id,
            String title,
            String jobType,
            String technology,
            String location,
            String workModel,
            String descriptionExcerpt
    ) {}

    public record DecisionLogEntry(
            UUID id,
            String decision,
            String reasonCode,
            String reasonCodeLabel,
            String reasonText,
            String previousStage,
            String newStage,
            String applicantVisibleMessage,
            UUID decidedById,
            String decidedByName,
            Instant decidedAt
    ) {}

    public record AvailableActions(
            boolean canShortlist,
            boolean canHold,
            boolean canRequestInfo,
            boolean canReject,
            boolean canResumeFromHold
    ) {}

    public record ErmDecisionRequest(
            String decision,                     // SHORTLIST | HOLD | REQUEST_INFO | REJECT
            String reasonCode,                   // ReasonCode enum value name
            String reasonText,                   // required when reasonCode.requiresFreeText
            List<String> infoRequestedFields     // required for REQUEST_INFO
    ) {}

    public record BulkDecisionRequest(
            List<UUID> applicationIds,
            ErmDecisionRequest decision
    ) {}

    public record BulkDecisionResult(
            List<UUID> succeeded,
            List<BulkFailure> failed
    ) {
        public record BulkFailure(UUID applicationId, String reason) {}
    }

    public record AssignOwnerRequest(UUID ermUserId) {}

    public record InternalNoteRequest(String note) {}

    public record InboxFilters(
            List<ApplicationStatus> stages,
            List<UUID> jobIds,
            String jobType,
            List<String> workAuthTypes,
            String dateFrom,
            String dateTo,
            String search,
            String scope          // mine | all | unassigned
    ) {}

    public record ReasonCodeGroup(
            String category,
            List<ReasonCodeOption> options
    ) {}

    public record ReasonCodeOption(
            String code,
            String label,
            boolean requiresFreeText
    ) {}

    /** Intern-side body for POST /api/v1/applications/{id}/provide-info. */
    public record ProvideInfoRequest(
            UUID resumeFileId,
            Map<String, Object> workAuthUpdate,
            Map<String, Object> educationUpdate,
            String freeTextResponse
    ) {}
}
