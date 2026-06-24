package com.skyzen.careers.mail.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One action. For MOVE_TO_FOLDER, exactly one of {@code targetFolder} (a system
 * folder name) or {@code targetCustomFolderId} (a custom folder id) is set; both
 * are null for the other action types.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MailRuleAction(
        MailRuleActionType type,
        String targetFolder,
        String targetCustomFolderId
) {
}
