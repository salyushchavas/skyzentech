package com.skyzen.careers.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class ApplicationCreateRequest {

    @NotNull(message = "jobPostingId is required")
    private UUID jobPostingId;

    @NotNull(message = "resumeId is required")
    private UUID resumeId;
}
