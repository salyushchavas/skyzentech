package com.skyzen.careers.dto.documents;

import com.skyzen.careers.enums.DocumentType;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentRecordResponse {
    private UUID id;
    private DocumentType type;
    private String title;
    private UUID candidateId;
    private String candidateName;
    private String candidateEmail;
    private String entityName;
    /** Raw status from the underlying entity (e.g. "COMPLETED", "DSO_APPROVED"). */
    private String status;
    /** Human-readable status (e.g. "Completed", "DSO Approved"). */
    private String statusLabel;
    /** One of: green, amber, red, blue, gray, purple, orange. */
    private String statusColor;
    private Instant createdAt;
    private Instant updatedAt;
    private String retentionPolicyText;
    private String linkUrl;
    /** Jackson serializes the boolean isImmutable() getter as "immutable". */
    private boolean immutable;
    /** Jackson serializes the boolean isHasAuditLog() getter as "hasAuditLog". */
    private boolean hasAuditLog;
}
