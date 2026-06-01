package com.skyzen.careers.dto.supervised;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReturnTimesheetRequest(
        @NotBlank @Size(min = 10, max = 2000) String reason
) {}
