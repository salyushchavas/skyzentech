package com.skyzen.careers.erm.offer;

import com.skyzen.careers.enums.OfferStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** ERM Phase 4 — DTO surface for offer control + new-hire list. */
public final class ErmOfferDtos {

    private ErmOfferDtos() {}

    public record OfferRow(
            UUID offerId,
            UUID applicationId,
            String applicantName,
            String applicantId,
            String applicantEmail,
            String jobTitle,
            String jobType,
            OfferStatus status,
            String roleTitle,
            String compensationSummary,
            LocalDate tentativeStartDate,
            Instant sentAt,
            Instant expiresAt,
            Instant signedAt,
            Instant voidedAt,
            String voidReasonCode,
            Integer reminderCount,
            String docusignEnvelopeId,
            Boolean archived
    ) {}

    public record OfferListPage(
            List<OfferRow> items,
            int page,
            int pageSize,
            long totalElements,
            int totalPages
    ) {}

    public record OfferDetail(
            UUID id,
            OfferStatus status,
            UUID applicationId,
            String applicantName,
            String applicantEmail,
            String applicantId,
            String jobTitle,
            String jobType,
            String roleTitle,
            String compensationSummary,
            String worksite,
            Integer expectedHoursPerWeek,
            LocalDate tentativeStartDate,
            Instant sentAt,
            Instant expiresAt,
            Instant signedAt,
            Instant voidedAt,
            String voidReasonCode,
            String voidReasonText,         // ERM-only
            Integer reminderCount,
            Instant lastReminderAt,
            String docusignEnvelopeId,
            UUID signedPdfDocumentId,
            String internalNotes,          // ERM-only
            Instant archivedAt,
            UUID createdBy,
            Instant createdAt,
            Instant updatedAt,
            List<EventLogEntry> history
    ) {}

    public record EventLogEntry(
            UUID id,
            String eventType,
            String reasonCode,
            String reasonText,             // ERM-only
            String payloadJson,
            UUID actorUserId,
            String actorName,
            Instant createdAt
    ) {}

    public record CreateOfferRequest(
            UUID applicationId,
            String roleTitle,
            String technology,
            LocalDate tentativeStartDate,
            String compensationSummary,
            String worksite,
            Integer expectedHoursPerWeek,
            Integer expiryDays,
            String contingencies,
            String templateOverrideKey
    ) {}

    public record ResendRequest(
            String reasonCode,
            String reasonText,
            Integer newExpiryDays
    ) {}

    public record VoidRequest(
            String reasonCode,
            String reasonText,
            Boolean notifyApplicant
    ) {}

    public record InternalNoteRequest(String note) {}

    public record UpdateStartDateRequest(LocalDate newDate) {}

    public record PreviewResponse(String subject, String body) {}

    public record ReasonCodeGroup(String category, List<ReasonCodeOption> options) {}
    public record ReasonCodeOption(String code, String label, boolean requiresFreeText) {}

    // ── New Hire List ────────────────────────────────────────────────────

    public record NewHireRow(
            UUID internLifecycleId,
            UUID internUserId,
            String internName,
            String internEmail,
            String employeeId,
            Instant signedAt,
            LocalDate tentativeStartDate,
            String trainerName,
            String evaluatorName,
            String managerName,
            boolean reportingStructureComplete,
            boolean onboardingAssigned
    ) {}

    public record NewHireListPage(
            List<NewHireRow> items,
            int page,
            int pageSize,
            long totalElements,
            int totalPages
    ) {}

    public record NewHireDetail(
            UUID internLifecycleId,
            UUID internUserId,
            String internName,
            String internEmail,
            String employeeId,
            String activeStatus,
            Instant hiredAt,
            Instant startedAt,
            LocalDate tentativeStartDate,
            boolean reportingStructureComplete,
            Instant reportingStructureCompletedAt,
            UUID reportingStructureCompletedById,
            UserStub trainer,
            UserStub evaluator,
            UserStub manager,
            UserStub erm,
            OfferSummaryStub signedOffer,
            boolean onboardingAssigned,
            /** Phase 8.9 — server-authoritative flag the ERM UI uses to
             *  show/hide the "Activate now" override. True iff the intern's
             *  User.lifecycleStatus is ONBOARDING_ACCEPTED AND a SIGNED offer
             *  exists. Never true before document verification completes, so
             *  the override can never skip onboarding. */
            boolean canActivateNow
    ) {}

    public record UserStub(
            UUID userId,
            String fullName,
            String email,
            String role,
            int currentInternCount
    ) {}

    public record OfferSummaryStub(
            UUID offerId,
            String roleTitle,
            String compensationSummary,
            String worksite,
            Integer expectedHoursPerWeek,
            LocalDate tentativeStartDate,
            Instant signedAt,
            UUID signedPdfDocumentId
    ) {}

    public record AssignReportingRequest(
            UUID trainerUserId,
            UUID evaluatorUserId,
            UUID managerUserId
    ) {}

    /** Phase 8.6.4 — inline Manager assignment from the New Hire detail page.
     *  {@code managerUserId == null} clears the assignment. */
    public record AssignManagerRequest(UUID managerUserId) {}

    // ── Phase 8.6 — Awaiting Offer queue ─────────────────────────────────
    // Applications in INTERVIEWED state with a COMPLETED interview where
    // decision=SELECTED, and no active offer (status NOT IN SENT, SIGNED)
    // for that application yet.

    public record AwaitingOfferRow(
            UUID applicationId,
            UUID interviewId,
            String applicantName,
            String applicantId,
            String applicantEmail,
            String jobTitle,
            String jobType,
            String technologyArea,
            Instant interviewCompletedAt,
            String overallRecommendation,
            Integer technicalScore,
            Integer communicationScore,
            String applicantVisibleNotes
    ) {}

    public record AwaitingOfferListPage(
            List<AwaitingOfferRow> items,
            int page,
            int pageSize,
            long totalElements,
            int totalPages
    ) {}
}
