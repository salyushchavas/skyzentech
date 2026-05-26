package com.skyzen.careers.dto.operations;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * One row in the open-postings summary. {@code applicationCount} is the total
 * across all statuses on the posting — Operations clicks through to the
 * postings page for the per-posting breakdown.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpenPostingResponse {
    private UUID id;
    private String title;
    private String entityName;
    private long applicationCount;
}
