package com.skyzen.careers.dto;

import com.skyzen.careers.enums.EmploymentType;
import com.skyzen.careers.enums.JobPostingStatus;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class JobPostingUpdateRequest {
    private String title;
    private String description;
    private String requirements;
    private String location;
    private EmploymentType employmentType;
    private JobPostingStatus status;
}
