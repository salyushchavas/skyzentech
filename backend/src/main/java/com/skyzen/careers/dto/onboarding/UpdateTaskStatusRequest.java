package com.skyzen.careers.dto.onboarding;

import com.skyzen.careers.enums.OnboardingTaskStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateTaskStatusRequest {

    @NotNull
    private OnboardingTaskStatus status;
}
