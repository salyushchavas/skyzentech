package com.skyzen.careers.dto.project.catalog;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.skyzen.careers.enums.Difficulty;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CatalogProjectResponse(
        UUID id,
        String name,
        String description,
        String techStack,
        Integer expectedDurationDays,
        String deliverables,
        Difficulty difficulty,
        String instructions,
        LocalDate startDate,
        LocalDate endDate,
        UserRef createdBy,
        Long assignmentCount,
        Instant createdAt,
        Instant updatedAt
) {
    public record UserRef(UUID id, String fullName) {}
}
