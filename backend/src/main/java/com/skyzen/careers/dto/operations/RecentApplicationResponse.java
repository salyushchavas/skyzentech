package com.skyzen.careers.dto.operations;

import com.skyzen.careers.enums.ApplicationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Minimal application row for the "Recent applications" list. Trimmed from
 * the staff {@code ApplicationResponse} — no resume, no recruiter notes, no
 * rating — since this is a navigation strip, not the review screen.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecentApplicationResponse {
    private UUID id;
    private String candidateName;
    private String position;
    private String entityName;
    private ApplicationStatus status;
    private Instant appliedAt;
}
