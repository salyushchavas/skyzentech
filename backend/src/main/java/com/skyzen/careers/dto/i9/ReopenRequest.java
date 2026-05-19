package com.skyzen.careers.dto.i9;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReopenRequest {

    @NotBlank
    private String reason;
}
