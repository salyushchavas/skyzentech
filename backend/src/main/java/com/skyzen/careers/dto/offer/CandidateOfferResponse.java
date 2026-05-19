package com.skyzen.careers.dto.offer;

import com.skyzen.careers.enums.CompensationFrequency;
import com.skyzen.careers.enums.OfferStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateOfferResponse {
    private UUID id;
    private String jobPostingTitle;
    private String entityName;
    private BigDecimal compensationAmount;
    private CompensationFrequency compensationFrequency;
    private String compensationCurrency;
    private LocalDate startDate;
    private LocalDate expectedEndDate;
    private Instant expiresAt;
    private OfferStatus status;
    private String additionalTerms;
    private String letterContent;
    private Instant sentAt;
    private Instant respondedAt;
    private boolean isExpired;
}
