package com.skyzen.careers.dto.everify;

import com.skyzen.careers.enums.EVerifyClosureReason;
import com.skyzen.careers.enums.EVerifyStatus;
import com.skyzen.careers.enums.PhotoMatchResult;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EVerifyCaseResponse {
    private UUID id;
    private UUID i9FormId;
    private String candidateName;
    private String candidateEmail;
    private UUID candidateId;
    private String caseNumber;
    private EVerifyStatus status;
    private EVerifyClosureReason closureReason;
    private Instant openedAt;
    private Instant closedAt;
    private Boolean photoMatchRequired;
    private PhotoMatchResult photoMatchResult;
    private Boolean additionalVerificationRequired;
    private String notes;
    private Long daysOpen;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdByName;
}
