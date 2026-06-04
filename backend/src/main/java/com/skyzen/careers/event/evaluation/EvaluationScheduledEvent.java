package com.skyzen.careers.event.evaluation;

import com.skyzen.careers.event.DomainEvent;
import lombok.Getter;

import java.util.UUID;

@Getter
public final class EvaluationScheduledEvent extends DomainEvent {
    private final UUID evaluationId;
    private final UUID internUserId;
    private final UUID evaluatorUserId;

    public EvaluationScheduledEvent(UUID evaluationId, UUID internUserId, UUID evaluatorUserId) {
        this.evaluationId = evaluationId;
        this.internUserId = internUserId;
        this.evaluatorUserId = evaluatorUserId;
    }
}
