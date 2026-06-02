package com.skyzen.careers.dto.project.catalog;

import jakarta.validation.constraints.Size;

public record SubmitAssignmentRequest(
        @Size(max = 5000) String submissionNotes
) {}
