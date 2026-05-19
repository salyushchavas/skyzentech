package com.skyzen.careers.dto.everify;

import com.skyzen.careers.enums.EVerifyStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateStatusRequest {

    @NotNull
    private EVerifyStatus status;

    /** Optional note; if provided, appended to existing notes with timestamp + actor prefix. */
    private String notes;
}
