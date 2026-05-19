package com.skyzen.careers.dto.everify;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EVerifyHistoryEntryResponse {
    private UUID auditId;
    private Instant timestamp;
    private String action;
    private String performedByName;
    private String performedByRole;
    private String summary;
}
