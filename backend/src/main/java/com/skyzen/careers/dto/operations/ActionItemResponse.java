package com.skyzen.careers.dto.operations;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One row in the "Needs your attention" queue. The frontend renders these as
 * a horizontal strip of cards, ordered server-side by the order they're
 * appended. Each is a deep-link to the page where Operations resolves them.
 *
 * {@code key} is a stable client identifier (e.g. {@code NEW_APPLICATIONS}) so
 * the frontend can pick an icon without parsing the label.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActionItemResponse {
    private String key;
    private String label;
    private long count;
    private String href;
}
