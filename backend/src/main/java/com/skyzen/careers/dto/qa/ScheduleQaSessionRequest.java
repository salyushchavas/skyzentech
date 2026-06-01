package com.skyzen.careers.dto.qa;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public record ScheduleQaSessionRequest(
        @NotNull UUID projectId,
        @NotNull Instant scheduledAt,
        @Size(max = 1024) String meetingLink
) {}
