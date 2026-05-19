package com.skyzen.careers.dto.compliance;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComplianceAlert {
    private AlertSeverity severity;
    private String title;
    private String description;
    private String linkUrl;
    private Integer count;
}
