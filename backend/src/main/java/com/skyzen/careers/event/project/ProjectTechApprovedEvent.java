package com.skyzen.careers.event.project;

import com.skyzen.careers.event.DomainEvent;

import java.util.UUID;

/**
 * Tech supervisor signed off — project is {@code TECH_APPROVED} and now
 * awaits Reporting Manager viva.
 */
public final class ProjectTechApprovedEvent extends DomainEvent {

    private final UUID projectId;
    private final UUID approverUserId;

    public ProjectTechApprovedEvent(UUID projectId, UUID approverUserId) {
        this.projectId = projectId;
        this.approverUserId = approverUserId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getApproverUserId() {
        return approverUserId;
    }
}
