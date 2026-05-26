package com.skyzen.careers.dto.material;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class CreateWeeklyMaterialRequest {

    @NotNull
    @Min(1)
    private Integer weekNo;

    @NotBlank
    @Size(max = 200)
    private String title;

    /** Optional supervisor narrative — Markdown / plain text accepted, no rendering server-side. */
    private String description;

    /** Optional external resource URLs (readings, videos, GitHub repos). Stored as JSON. */
    private List<String> resourceUrls;

    /** Optional. Defaults to a week from release date if the supervisor leaves it blank. */
    private LocalDate dueDate;

    /**
     * Optional. Null → broadcast to all ACTIVE interns at release time. Set →
     * scoped to a single engagement; the actor must be that engagement's
     * supervisor (or hold ERM/ADMIN) at release time — see GAP B6 shape.
     */
    private UUID engagementId;
}
