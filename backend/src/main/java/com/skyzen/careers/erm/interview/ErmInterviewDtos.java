package com.skyzen.careers.erm.interview;

import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.enums.InterviewType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** ERM Phase 3 — DTO surface for the interview scheduler + decision center. */
public final class ErmInterviewDtos {

    private ErmInterviewDtos() {}

    public record ErmInterviewRow(
            UUID interviewId,
            UUID applicationId,
            String applicantName,
            String applicantId,
            String jobTitle,
            String jobType,
            Instant scheduledAt,
            Integer durationMinutes,
            String timezone,
            InterviewStatus status,
            String decision,
            UUID interviewerId,
            String interviewerName,
            int rescheduleCount
    ) {}

    public record ErmInterviewListPage(
            List<ErmInterviewRow> items,
            int page,
            int pageSize,
            long totalElements,
            int totalPages
    ) {}

    public record CalendarEntry(
            UUID interviewId,
            UUID applicationId,
            String applicantName,
            String jobTitle,
            Instant scheduledAt,
            Integer durationMinutes,
            String timezone,
            InterviewStatus status,
            String decision,
            String interviewerName
    ) {}

    /**
     * Role-shaped detail. Field RBAC handled at the service:
     *  - INTERN: zoomStartUrl, internalNotes, decisionReasonText, scores → null
     *  - TRAINER / EVALUATOR (not on panel): null on the same fields
     *  - MANAGER: scores + recommendation present; internalNotes + decisionReasonText null
     *  - ERM / SUPER_ADMIN / interviewer / panel: full payload
     */
    public record ErmInterviewDetail(
            UUID id,
            InterviewStatus status,
            InterviewType type,
            Instant scheduledAt,
            Integer durationMinutes,
            String timezone,
            String prepInstructions,
            String zoomJoinUrl,
            String zoomStartUrl,             // ERM/interviewer only
            String zoomPassword,             // ERM/interviewer only
            Long zoomMeetingId,
            String decision,
            String overallRecommendation,
            Integer technicalScore,
            Integer communicationScore,
            Integer culturalFitScore,
            String applicantVisibleNotes,
            String internalNotes,            // ERM/MANAGER only — but actually ERM-only per spec
            String decisionReasonCode,
            String decisionReasonText,       // ERM-only
            int rescheduleCount,
            String lastRescheduleReasonCode,
            String lastRescheduleReasonText, // ERM-only
            Instant lastRescheduledAt,
            String cancellationReasonCode,
            String cancellationReasonText,   // ERM-only
            Instant cancelledAt,
            UUID createdBy,
            Instant createdAt,
            Instant updatedAt,
            ApplicantView applicant,
            JobView job,
            InterviewerView interviewer,
            List<InterviewerView> panel,
            List<EventLogEntry> history,
            AvailableActions availableActions,
            String callerRole
    ) {}

    public record ApplicantView(
            UUID userId,
            String firstName,
            String lastName,
            String email,
            String applicantId,
            UUID applicationId,
            String applicationStatus
    ) {}

    public record JobView(
            UUID id,
            String title,
            String jobType,
            String location
    ) {}

    public record InterviewerView(
            UUID userId,
            String fullName,
            String email,
            String role,
            String zoomEmail,
            boolean hasZoomEmail
    ) {}

    public record EventLogEntry(
            UUID id,
            String eventType,
            String reasonCode,
            String reasonText,            // ERM-only — stripped in non-ERM views
            String payloadJson,
            UUID actorUserId,
            String actorName,
            Instant createdAt
    ) {}

    public record AvailableActions(
            boolean canComplete,
            boolean canReschedule,
            boolean canChangeInterviewer,
            boolean canCancel,
            boolean canEditNotes,
            boolean canSendReminder
    ) {}

    public record ErmCreateInterviewRequest(
            UUID applicationId,
            Instant scheduledFor,
            Integer durationMinutes,
            String timezone,
            UUID interviewerId,
            List<UUID> panelInterviewerIds,
            String prepInstructions,
            String templateKey,
            String manualZoomLink,
            InterviewType type
    ) {}

    public record ErmRescheduleRequest(
            Instant scheduledFor,
            Integer durationMinutes,
            String reasonCode,
            String reasonText,
            Boolean notifyApplicant,
            Boolean notifyInterviewer
    ) {}

    public record ChangeInterviewerRequest(UUID interviewerId) {}

    public record ErmCompleteRequest(
            String decision,                       // SELECTED | HOLD | REJECTED
            String decisionReasonCode,
            String decisionReasonText,
            Integer technicalScore,
            Integer communicationScore,
            Integer culturalFitScore,
            String overallRecommendation,          // STRONG_HIRE | HIRE | NO_HIRE | STRONG_NO_HIRE
            String applicantVisibleNotes,
            String internalNotes
    ) {}

    public record ErmCancelRequest(
            String reasonCode,
            String reasonText,
            Boolean notifyApplicant
    ) {}

    public record NotesRequest(
            String applicantVisibleNotes,
            String internalNotes
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
}
