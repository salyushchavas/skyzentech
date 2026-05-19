package com.skyzen.careers.dto;

import com.skyzen.careers.enums.EmploymentType;
import com.skyzen.careers.enums.JobPostingStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobPostingResponse {
    private UUID id;
    private String slug;
    private String title;
    private String description;
    private String requirements;
    private String location;
    private EmploymentType employmentType;
    private JobPostingStatus status;
    private String entityName;
    private Instant publishedAt;
    private Instant createdAt;
}
