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
    /** 1-5 from the review screen, nullable. */
    private Integer recruiterRating;

    /** Phase 2 — applicant-typed motivation captured at apply time. */
    private String statementOfInterest;

    /** Phase 2 — applicant-safe outcome message; null until ERM sets it. */
    private String applicantVisibleFeedback;
}
