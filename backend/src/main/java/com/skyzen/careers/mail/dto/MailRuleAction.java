package com.skyzen.careers.mail.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/** One action. {@code targetFolder} is required only for MOVE_TO_FOLDER. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MailRuleAction(
        MailRuleActionType type,
        String targetFolder
) {
}
