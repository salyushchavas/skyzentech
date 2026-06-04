package com.skyzen.careers.dto.offer;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Phase 3 doc-spec request for the atomic "create offer + send DocuSign
 * envelope" flow exposed at {@code POST /api/v1/offers}. Differs from the
 * legacy {@link CreateOfferRequest} (which created a DRAFT row for the
 * pre-DocuSign manual flow) — Phase 3 is single-shot and always SENT.
 */
@Getter
@Setter
public class SendDocusignOfferRequest {

    @NotNull(message = "applicationId is required")
    private UUID applicationId;

    @NotNull(message = "tentativeStartDate is required")
    @Future(message = "tentativeStartDate must be in the future")
    private LocalDate tentativeStartDate;

    @NotBlank(message = "roleTitle is required")
    @Size(max = 200)
    private String roleTitle;

    @Size(max = 500)
    private String compensationSummary;

    @Size(max = 200)
    private String worksite;

    @Min(1)
    @Max(80)
    private Integer expectedHoursPerWeek;

    /** Offer expires if not signed within this many days. 1-60; default 7. */
    @Min(1)
    @Max(60)
    private Integer expiryDays;
}
