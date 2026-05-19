package com.skyzen.careers.dto.interview;

import com.skyzen.careers.enums.InterviewStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateStatusRequest {

    @NotNull
    private InterviewStatus status;
}
