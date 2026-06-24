package com.skyzen.careers.mail.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.mail.dto.MailRuleAction;
import com.skyzen.careers.mail.dto.MailRuleCondition;
import com.skyzen.careers.mail.entity.MailFolder;
import com.skyzen.careers.mail.entity.MailRule;
import com.skyzen.careers.mail.entity.MailRuleMatchMode;
import com.skyzen.careers.mail.repository.MailRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Delivery-time inbox rules. {@link #resolveDelivery} computes the initial
 * mailbox-entry state for a recipient by running that account's enabled rules in
 * priority order.
 *
 * <p>TOP INVARIANT — FAIL-OPEN: a rule must NEVER drop or fail a delivery. Any
 * exception (bad JSON, unknown enum, anything) is swallowed and the recipient
 * gets the default INBOX / unread entry. A single malformed rule is skipped
 * without affecting the others.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MailRuleEngine {

    private static final TypeReference<List<MailRuleCondition>> CONDITION_LIST = new TypeReference<>() {
    };
    private static final TypeReference<List<MailRuleAction>> ACTION_LIST = new TypeReference<>() {
    };

    private final MailRuleRepository ruleRepository;
    private final ObjectMapper objectMapper;

    /** The visible facts of a message, built once per delivery. */
    public record RuleContext(
            String fromEmail,
            List<String> toEmails,
            List<String> ccEmails,
            String subject,
            boolean hasAttachment
    ) {
    }

    /** The resolved initial mailbox-entry state for one recipient. */
    public record DeliveryDecision(MailFolder folder, boolean read, boolean starred, boolean important) {
        public static DeliveryDecision inbox() {
            return new DeliveryDecision(MailFolder.INBOX, false, false, false);
        }
    }

    public DeliveryDecision resolveDelivery(UUID accountId, RuleContext ctx) {
        try {
            List<MailRule> rules =
                    ruleRepository.findByAccountIdAndEnabledTrueOrderByPriorityAscCreatedAtAsc(accountId);
            if (rules.isEmpty()) {
                return DeliveryDecision.inbox();
            }
            MailFolder folder = MailFolder.INBOX;
            boolean read = false;
            boolean starred = false;
            boolean important = false;
            for (MailRule rule : rules) {
                try {
                    List<MailRuleCondition> conditions = parse(rule.getConditionsJson(), CONDITION_LIST);
                    if (!matches(rule.getMatchMode(), conditions, ctx)) {
                        continue;
                    }
                    for (MailRuleAction action : parse(rule.getActionsJson(), ACTION_LIST)) {
                        if (action == null || action.type() == null) {
                            continue;
                        }
                        switch (action.type()) {
                            case MARK_READ -> read = true;
                            case STAR -> starred = true;
                            case MARK_IMPORTANT -> important = true;
                            // DELETE is an intentional user action → Trash, not a dropped message.
                            case DELETE -> folder = MailFolder.TRASH;
                            case MOVE_TO_FOLDER -> {
                                MailFolder target = parseFolder(action.targetFolder());
                                if (target != null) {
                                    folder = target;
                                }
                            }
                        }
                    }
                    if (rule.isStopProcessing()) {
                        break;
                    }
                } catch (Exception perRule) {
                    log.warn("mail rule {} skipped (eval error): {}", rule.getId(), perRule.toString());
                }
            }
            return new DeliveryDecision(folder, read, starred, important);
        } catch (Exception e) {
            log.warn("mail rule engine failed for account {} — defaulting to INBOX: {}", accountId, e.toString());
            return DeliveryDecision.inbox();
        }
    }

    private boolean matches(MailRuleMatchMode mode, List<MailRuleCondition> conditions, RuleContext ctx) {
        if (conditions == null || conditions.isEmpty()) {
            return false; // a rule with no conditions never auto-fires
        }
        if (mode == MailRuleMatchMode.ANY) {
            for (MailRuleCondition c : conditions) {
                if (matchOne(c, ctx)) {
                    return true;
                }
            }
            return false;
        }
        for (MailRuleCondition c : conditions) {
            if (!matchOne(c, ctx)) {
                return false;
            }
        }
        return true;
    }

    private boolean matchOne(MailRuleCondition c, RuleContext ctx) {
        if (c == null || c.field() == null || c.operator() == null) {
            return false;
        }
        return switch (c.field()) {
            case HAS_ATTACHMENT -> ctx.hasAttachment();
            case FROM -> strOp(c, ctx.fromEmail());
            case SUBJECT -> strOp(c, ctx.subject());
            case TO -> anyOp(c, ctx.toEmails());
            case CC -> anyOp(c, ctx.ccEmails());
        };
    }

    private boolean anyOp(MailRuleCondition c, List<String> values) {
        if (values == null) {
            return false;
        }
        for (String v : values) {
            if (strOp(c, v)) {
                return true;
            }
        }
        return false;
    }

    private boolean strOp(MailRuleCondition c, String fieldValue) {
        if (fieldValue == null) {
            return false;
        }
        String hay = fieldValue.toLowerCase(Locale.ROOT);
        String needle = c.value() == null ? "" : c.value().toLowerCase(Locale.ROOT).trim();
        return switch (c.operator()) {
            case CONTAINS -> !needle.isEmpty() && hay.contains(needle);
            case EQUALS -> hay.equals(needle);
            case IS_TRUE -> false; // only meaningful for HAS_ATTACHMENT, handled above
        };
    }

    private <T> List<T> parse(String json, TypeReference<List<T>> type) throws Exception {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        return objectMapper.readValue(json, type);
    }

    private static MailFolder parseFolder(String s) {
        if (s == null) {
            return null;
        }
        try {
            return MailFolder.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            return null;
        }
    }
}
