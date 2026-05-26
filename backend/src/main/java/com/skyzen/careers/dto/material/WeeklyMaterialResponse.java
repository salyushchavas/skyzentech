package com.skyzen.careers.dto.material;

import com.skyzen.careers.enums.WeeklyMaterialStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class WeeklyMaterialResponse {

    private UUID id;
    private Integer weekNo;
    private String title;
    private String description;
    private List<String> resourceUrls;
    private LocalDate dueDate;
    private Instant releaseDate;

    private UUID publishedById;
    private String publishedByName;

    /** Null for broadcasts. */
    private UUID engagementId;
    /** Convenience: candidate name for scoped publishes (null for broadcasts). */
    private String scopedToCandidateName;

    private WeeklyMaterialStatus status;
    private Instant createdAt;

    // ── Intern-side fields (null on supervisor views) ───────────────────────

    /** True if THIS caller (intern) has acknowledged this material. */
    private Boolean acknowledged;
    private Instant acknowledgedAt;

    // ── Supervisor-side fields (null on intern views) ───────────────────────

    /** Total acknowledgements across all interns. Populated for the publisher's list. */
    private Long acknowledgementCount;
}
