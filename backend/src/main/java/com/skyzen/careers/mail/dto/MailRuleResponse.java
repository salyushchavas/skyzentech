package com.skyzen.careers.mail.dto;

import com.skyzen.careers.mail.entity.MailRuleMatchMode;

import java.time.Instant;
import java.util.List;

public record MailRuleResponse(
        String id,
        String name,
        int priority,
        boolean enabled,
        MailRuleMatchMode matchMode,
        boolean stopProcessing,
        List<MailRuleCondition> conditions,
        List<MailRuleAction> actions,
        Instant createdAt,
        Instant updatedAt
) {
}
