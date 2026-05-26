package com.skyzen.careers.dto.hr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One row in the HR "Needs your attention" queue. Same shape as the operations
 * dashboard's action item but kept separate so the two contracts can diverge
 * (HR may need urgency severities later; ops doesn't).
 *
 * {@code key} is a stable client identifier so the frontend can pick an icon
 * without parsing the label.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HrActionItemResponse {
    private String key;
    private String label;
    private long count;
    private String href;
}
