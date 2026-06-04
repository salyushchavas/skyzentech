package com.skyzen.careers.event.evaluation;

import com.skyzen.careers.event.DomainEvent;
import lombok.Getter;

import java.util.UUID;

@Getter
public final class EvaluationDraftedEvent extends DomainEvent {
    private final UUID evaluationId;
    private final UUID evaluatorUserId;
    private final String evaluationType;
    private final UUID linkedProjectId;

    public EvaluationDraftedEvent(UUID evaluationId, UUID evaluatorUserId,
                                   String evaluationType, UUID linkedProjectId) {
        this.evaluationId = evaluationId;
        this.evaluatorUserId = evaluatorUserId;
        this.evaluationType = evaluationType;
        this.linkedProjectId = linkedProjectId;
    }
}
