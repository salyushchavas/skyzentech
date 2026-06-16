package com.skyzen.careers.dto.project.catalog;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.skyzen.careers.enums.Difficulty;
import com.skyzen.careers.enums.ProjectAssignmentStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProjectAssignmentResponse(
        UUID id,
        ProjectRef project,
        UserRef intern,
        UserRef assignedBy,
        LocalDate assignmentDate,
        LocalDate dueDate,
        String remarks,
        ProjectAssignmentStatus status,

        // ── Out-of-band GitHub-access tracking ──
        Boolean accessGranted,
        Instant accessGrantedAt,
        UserRef accessGrantedBy,

        // ── Status-transition timestamps ──
        Instant startedAt,
        Instant submittedAt,
        String submissionNotes,

        /** Latest {@code ProjectSubmission} row for this project (if any) —
         *  carries the deliverable links + trainer feedback so the intern's
         *  My Projects detail page can show what was submitted and what
         *  the trainer said. Null until the intern submits at least once. */
        LatestSubmission latestSubmission,

        Instant createdAt,
        Instant updatedAt
) {
    public record ProjectRef(
            UUID id,
            String name,
            String techStack,
            Difficulty difficulty,
            String description,
            String requirements,
            String objectives,
            String deliverables,
            String instructions,
            Integer expectedDurationDays,
            LocalDate startDate,
            LocalDate endDate,
            RepositorySummary repository,
            /** KT (Knowledge Transfer) — null when not assigned (catalog-only). */
            KtSummary kt
    ) {}

    public record KtSummary(
            String status,            // NOT_DONE | DONE
            Instant completedAt,
            String meetingLink,
            String notes,
            String markedByName
    ) {}

    public record RepositorySummary(
            String repositoryName,
            String repositoryUrl
    ) {}

    public record UserRef(
            UUID id,
            String fullName,
            String email,
            String githubUsername
    ) {}

    /**
     * Projection of {@code ProjectSubmission} relevant to the intern:
     * what they sent, when, what version, and whatever the trainer
     * decided/wrote. Trainer-private fields (scores, blockers note) are
     * intentionally left off — the intern surface only needs the public
     * decision + feedback.
     */
    public record LatestSubmission(
            UUID id,
            Integer version,
            List<String> links,
            String description,
            Instant submittedAt,
            String trainerDecision,    // ACCEPT | REQUEST_REVISION | ESCALATE | NO_ACTION_YET
            String trainerFeedback,    // verbatim text — shown to intern
            Instant reviewedAt,
            String reviewedByName
    ) {}
}
