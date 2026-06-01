package com.skyzen.careers.dto.rm;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.skyzen.careers.dto.qa.QaSessionResponse;
import com.skyzen.careers.dto.supervised.TimesheetWeekResponse;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReportingManagerDashboardResponse(
        long pendingQaCount,
        long qaInProgressCount,
        long pendingTimesheetCount,
        long completedThisMonthCount,
        List<ProjectAwaitingQa> projectsAwaitingQa,
        List<QaSessionResponse> qaInProgress,
        List<TimesheetWeekResponse> pendingTimesheets
) {
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ProjectAwaitingQa(
            UUID projectId,
            String projectTitle,
            UUID internUserId,
            String internName,
            Instant techApprovedAt
    ) {}
}
