package com.skyzen.careers.dto.hr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

/**
 * One row in the work-authorization expiry reminders strip. Carries name +
 * authorization type + expiration date only — NO document numbers, no SSN.
 *
 * {@code authType} is a human-readable label (e.g. "STEM OPT", "Work auth"),
 * not an enum value, so the frontend can render it directly.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthExpiryItemResponse {
    private UUID candidateId;
    private String candidateName;
    private String authType;
    private LocalDate expirationDate;
    private Integer daysUntilExpiry;
    private String linkUrl;
}
