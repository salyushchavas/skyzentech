package com.skyzen.careers.dto.material;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class MaterialAcknowledgementResponse {
    private UUID id;
    private UUID materialId;
    private UUID internCandidateId;
    private String internName;
    private String internEmail;
    private Instant acknowledgedAt;
}
