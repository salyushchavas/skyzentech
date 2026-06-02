package com.skyzen.careers.dto.project.catalog;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.skyzen.careers.enums.Difficulty;
import com.skyzen.careers.enums.ProjectAssignmentStatus;

import java.time.Instant;
import java.time.LocalDate;
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
            RepositorySummary repository
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
}
