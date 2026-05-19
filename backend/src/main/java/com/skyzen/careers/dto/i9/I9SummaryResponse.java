package com.skyzen.careers.dto.i9;

import com.skyzen.careers.enums.I9Status;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class I9SummaryResponse {
    private UUID id;
    private UUID candidateId;
    private String candidateName;
    private String candidateEmail;
    private String jobPostingTitle;
    private I9Status status;
    private LocalDate firstDayOfEmployment;
    private LocalDate section2DueDate;
    private boolean overdue;
    private Long daysUntilDue;
}
