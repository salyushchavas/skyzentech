package com.skyzen.careers.dto.everify;

import com.skyzen.careers.enums.EVerifyClosureReason;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CloseCaseRequest {

    @NotNull
    private EVerifyClosureReason closureReason;

    private String notes;
}
