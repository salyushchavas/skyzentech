package com.skyzen.careers.mail.dto;

import com.skyzen.careers.mail.entity.MailRuleMatchMode;

import java.util.List;

/**
 * Create/update payload. Boxed fields are nullable so the service can apply
 * defaults (priority 100, enabled true, matchMode ALL, stopProcessing false).
 */
public record MailRuleRequest(
        String name,
        Integer priority,
        Boolean enabled,
        MailRuleMatchMode matchMode,
        Boolean stopProcessing,
        List<MailRuleCondition> conditions,
        List<MailRuleAction> actions
) {
}
