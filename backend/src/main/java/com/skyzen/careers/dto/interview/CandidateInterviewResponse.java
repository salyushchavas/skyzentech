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
public class CandidateInterviewResponse {
    private UUID id;
    private Instant scheduledAt;
    private Integer durationMinutes;
    private InterviewType type;
    private InterviewStatus status;
    private String meetingUrl;
    private String candidateNotes;
    private String interviewerName;
}
