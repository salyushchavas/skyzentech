package com.skyzen.careers.dto;

import com.skyzen.careers.enums.ApplicationStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationResponse {
    private UUID id;
    private String candidateName;
    private String candidateEmail;
    private String jobPostingTitle;
    private UUID jobPostingId;
    private UUID resumeId;
    private String resumeFileName;
    private ApplicationStatus status;
    private Instant appliedAt;
    private Instant statusUpdatedAt;
    private String recruiterNotes;
}
