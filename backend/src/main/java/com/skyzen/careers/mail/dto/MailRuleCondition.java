package com.skyzen.careers.mail.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One condition. {@code value} is the text to match for FROM/TO/CC/SUBJECT and is
 * ignored for HAS_ATTACHMENT (which uses IS_TRUE).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MailRuleCondition(
        MailRuleField field,
        MailRuleOperator operator,
        String value
) {
}
