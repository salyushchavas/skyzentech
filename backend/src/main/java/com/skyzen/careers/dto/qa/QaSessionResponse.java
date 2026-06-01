package com.skyzen.careers.dto.qa;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.skyzen.careers.enums.QaSessionStatus;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record QaSessionResponse(
        UUID id,
        UUID projectId,
        String projectTitle,
        UUID internUserId,
        String internName,
        Instant scheduledAt,
        String meetingLink,
        QaSessionStatus status,
        String questionsAsked,
        String internResponses,
        Integer marks,
        String remarks,
        UUID scheduledByUserId,
        UUID conductedByUserId,
        Instant completedAt,
        Instant returnedAt,
        String returnReason,
        Instant createdAt,
        Instant updatedAt
) {}
