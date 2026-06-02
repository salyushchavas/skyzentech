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
        String notes,
        ProjectAssignmentStatus status,
        Instant createdAt,
        Instant updatedAt
) {
    public record ProjectRef(
            UUID id,
            String name,
            String techStack,
            Difficulty difficulty,
            String description,
            String deliverables,
            String instructions,
            Integer expectedDurationDays,
            LocalDate startDate,
            LocalDate endDate
    ) {}

    public record UserRef(UUID id, String fullName, String email) {}
}
