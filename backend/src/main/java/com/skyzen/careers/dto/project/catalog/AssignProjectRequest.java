package com.skyzen.careers.dto.project.catalog;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record AssignProjectRequest(
        @NotNull UUID projectId,
        @NotEmpty List<UUID> internIds,
        @NotNull LocalDate assignmentDate,
        LocalDate dueDate,
        @Size(max = 2000) String notes
) {}
