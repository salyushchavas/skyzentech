package com.skyzen.careers.dto.interview;

import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.enums.InterviewType;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewSummaryResponse {
    private UUID id;
    private String candidateName;
    private String jobPostingTitle;
    private String interviewerName;
    private Instant scheduledAt;
    private Integer durationMinutes;
    private InterviewType type;
    private InterviewStatus status;
    private boolean hasFeedback;
}
