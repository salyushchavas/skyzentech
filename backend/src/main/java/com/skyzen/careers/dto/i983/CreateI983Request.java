package com.skyzen.careers.dto.i983;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateI983Request {

    @NotNull
    private UUID candidateId;

    /** Optional — if known, helps auto-fill more from the application context. */
    private UUID applicationId;

    /** Optional — if known, snapshots compensation + dates from the offer. */
    private UUID offerId;
}
