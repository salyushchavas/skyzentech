package com.skyzen.careers.dto.hr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Offer status summary block:
 *
 * <ul>
 *   <li>{@code sent} — offers currently OUT (status = SENT)</li>
 *   <li>{@code accepted} — offers accepted in the trailing 30-day window</li>
 *   <li>{@code pending} — offers still in DRAFT (HR hasn't sent yet)</li>
 * </ul>
 *
 * Matches the buckets exposed by the existing ComplianceOverviewService
 * stats block.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OfferStatusSummaryResponse {
    private long sent;
    private long accepted;
    private long pending;
}
