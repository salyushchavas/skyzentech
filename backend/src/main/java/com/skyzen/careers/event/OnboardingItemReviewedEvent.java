package com.skyzen.careers.event;

import lombok.Getter;

import java.util.UUID;

@Getter
public final class OnboardingItemReviewedEvent extends DomainEvent {
    private final UUID itemId;
    private final UUID applicantUserId;
    private final String category;
    private final String decision; // ACCEPT | REJECT | RESEND

    public OnboardingItemReviewedEvent(UUID itemId, UUID applicantUserId,
                                       String category, String decision) {
        this.itemId = itemId;
        this.applicantUserId = applicantUserId;
        this.category = category;
        this.decision = decision;
    }
}
