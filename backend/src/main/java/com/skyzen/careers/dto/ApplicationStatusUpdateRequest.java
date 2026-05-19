package com.skyzen.careers.dto;

import com.skyzen.careers.enums.ApplicationStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ApplicationStatusUpdateRequest {

    @NotNull(message = "status is required")
    private ApplicationStatus status;

    private String recruiterNotes;
}
