package com.skyzen.careers.dto;

import com.skyzen.careers.enums.JobPostingStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class JobPostingStatusUpdateRequest {
    @NotNull(message = "status is required")
    private JobPostingStatus status;
}
