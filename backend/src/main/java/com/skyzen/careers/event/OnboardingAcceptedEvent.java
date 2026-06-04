package com.skyzen.careers.event;

import lombok.Getter;

import java.util.UUID;

@Getter
public final class OnboardingAcceptedEvent extends DomainEvent {
    private final UUID packetId;
    private final UUID applicantUserId;

    public OnboardingAcceptedEvent(UUID packetId, UUID applicantUserId) {
        this.packetId = packetId;
        this.applicantUserId = applicantUserId;
    }
}
