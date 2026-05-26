package com.skyzen.careers.dto.material;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Patch-shape update: null field = no change. Only DRAFT materials are
 * editable — the service rejects updates on RELEASED rows with a 400.
 *
 * Note: {@code engagementId} can be re-pointed while DRAFT, including
 * cleared back to null (broadcast). Use {@code clearEngagement=true} to
 * explicitly null it (otherwise null = "leave unchanged").
 */
@Data
public class UpdateWeeklyMaterialRequest {

    @Min(1)
    private Integer weekNo;

    @Size(max = 200)
    private String title;

    private String description;

    private List<String> resourceUrls;

    private LocalDate dueDate;

    private UUID engagementId;

    /** Set true to switch from scoped→broadcast (null the engagement_id). */
    private Boolean clearEngagement;
}
