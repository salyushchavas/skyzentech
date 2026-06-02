package com.skyzen.careers.dto.project.catalog;

import com.skyzen.careers.enums.Difficulty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateCatalogProjectRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 5000) String description,
        @Size(max = 5000) String requirements,
        @Size(max = 5000) String objectives,
        @Size(max = 500) String techStack,
        Integer expectedDurationDays,
        @Size(max = 5000) String deliverables,
        Difficulty difficulty,
        @Size(max = 5000) String instructions,
        LocalDate startDate,
        LocalDate endDate
) {}
