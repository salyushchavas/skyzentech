package com.skyzen.careers.dto.i983;

import com.skyzen.careers.enums.DsoApprovalStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DsoResponseRequest {

    /** Must be APPROVED, REJECTED, or AMENDMENT_REQUESTED. Validated in the service. */
    @NotNull
    private DsoApprovalStatus approvalStatus;

    /** Optional but encouraged for REJECTED / AMENDMENT_REQUESTED. */
    private String notes;
}
