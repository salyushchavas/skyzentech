package com.skyzen.careers.dto.qa;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReturnQaSessionRequest(
        @NotBlank @Size(min = 10, max = 2000) String reason
) {}
