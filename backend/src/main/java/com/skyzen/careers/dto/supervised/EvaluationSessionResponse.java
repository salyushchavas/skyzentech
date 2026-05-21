package com.skyzen.careers.dto.supervised;

import com.skyzen.careers.enums.EvaluationSessionStatus;
import lombok.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvaluationSessionResponse {
    private UUID id;
    private LocalDateTime scheduledAt;
    private EvaluationSessionStatus status;
    private String evaluatorName;
    private UUID evaluatorId;
    private Integer overallRating;
    private String strengths;
    private String areasForImprovement;
    private String notes;
    private Instant completedAt;
    private Instant createdAt;
}
