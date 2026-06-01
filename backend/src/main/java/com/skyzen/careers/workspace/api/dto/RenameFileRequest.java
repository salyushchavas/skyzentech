package com.skyzen.careers.workspace.api.dto;

import jakarta.validation.constraints.NotBlank;

public record RenameFileRequest(
        @NotBlank String fromPath,
        @NotBlank String toPath
) {}
