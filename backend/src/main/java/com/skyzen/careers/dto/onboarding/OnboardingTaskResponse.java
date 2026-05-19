package com.skyzen.careers.dto.onboarding;

import com.skyzen.careers.enums.OnboardingCategory;
import com.skyzen.careers.enums.OnboardingTaskStatus;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OnboardingTaskResponse {
    private UUID id;
    private String taskKey;
    private String title;
    private String description;
    private OnboardingCategory category;
    private OnboardingTaskStatus status;
    private Integer sortOrder;
    private LocalDate dueDate;
    private String linkUrl;
    private Instant completedAt;
    private String completedByName;
    private UUID offerId;
    private UUID applicationId;
    /** Computed: status is incomplete AND dueDate exists AND dueDate < today. */
    private boolean overdue;
    private Instant createdAt;
    private Instant updatedAt;
}
