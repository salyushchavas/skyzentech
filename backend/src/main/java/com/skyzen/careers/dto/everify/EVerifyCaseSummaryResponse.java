package com.skyzen.careers.dto.everify;

import com.skyzen.careers.enums.EVerifyStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EVerifyCaseSummaryResponse {
    private UUID id;
    private UUID i9FormId;
    private String candidateName;
    private String candidateEmail;
    private String caseNumber;
    private EVerifyStatus status;
    private Instant openedAt;
    private Instant closedAt;
    private Long daysOpen;
    private Instant createdAt;
    private Instant updatedAt;
}
