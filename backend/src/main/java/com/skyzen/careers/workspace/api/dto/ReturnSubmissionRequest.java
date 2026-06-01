package com.skyzen.careers.workspace.api.dto;

import jakarta.validation.constraints.NotBlank;

public record ReturnSubmissionRequest(
        @NotBlank String reason
) {}
