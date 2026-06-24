package com.skyzen.careers.mail.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.mail.auth.MailPrincipal;
import com.skyzen.careers.mail.dto.MailRuleAction;
import com.skyzen.careers.mail.dto.MailRuleActionType;
import com.skyzen.careers.mail.dto.MailRuleCondition;
import com.skyzen.careers.mail.dto.MailRuleField;
import com.skyzen.careers.mail.dto.MailRuleOperator;
import com.skyzen.careers.mail.dto.MailRuleRequest;
import com.skyzen.careers.mail.dto.MailRuleResponse;
import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.entity.MailFolder;
import com.skyzen.careers.mail.entity.MailRule;
import com.skyzen.careers.mail.entity.MailRuleMatchMode;
import com.skyzen.careers.mail.exception.MailApiException;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import com.skyzen.careers.mail.repository.MailRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Walled CRUD for per-account inbox rules. Every op re-loads the actor and scopes
 * by accountId; a foreign rule id returns 404 (anti-enumeration). Conditions and
 * actions are validated then stored as JSON TEXT. Bodies are NOT touched here —
 * rules are config, not message content.
 */
@Service
@RequiredArgsConstructor
public class MailRuleService {

    private static final int MAX_RULES = 100;
    private static final int MAX_ITEMS = 25;
    private static final int MAX_NAME = 120;
    private static final int MAX_VALUE = 500;
    /** Folders a MOVE_TO_FOLDER action may target (SENT/DRAFTS are nonsensical for inbound). */
    private static final Set<MailFolder> MOVE_TARGETS = EnumSet.of(MailFolder.INBOX, MailFolder.ARCHIVE, MailFolder.TRASH);

    private final MailRuleRepository ruleRepository;
    private final MailAccountRepository accountRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<MailRuleResponse> list(MailPrincipal principal) {
        MailAccount actor = loadActor(principal);
        return ruleRepository.findByAccountIdOrderByPriorityAscCreatedAtAsc(actor.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MailRuleResponse get(MailPrincipal principal, UUID id) {
        MailAccount actor = loadActor(principal);
        return toResponse(load(actor.getId(), id));
    }

    @Transactional
    public MailRuleResponse create(MailPrincipal principal, MailRuleRequest req) {
        MailAccount actor = loadActor(principal);
        if (ruleRepository.countByAccountId(actor.getId()) >= MAX_RULES) {
            throw badRequest("Rule limit reached (" + MAX_RULES + ")", "MAIL_RULE_LIMIT");
        }
        List<MailRuleCondition> conditions = validateConditions(req.conditions());
        List<MailRuleAction> actions = validateActions(req.actions());
        MailRule rule = MailRule.builder()
                .accountId(actor.getId())
                .name(validateName(req.name()))
                .priority(req.priority() != null ? req.priority() : 100)
                .enabled(req.enabled() == null || req.enabled())
                .matchMode(req.matchMode() != null ? req.matchMode() : MailRuleMatchMode.ALL)
                .stopProcessing(Boolean.TRUE.equals(req.stopProcessing()))
                .conditionsJson(write(conditions))
                .actionsJson(write(actions))
                .build();
        return toResponse(ruleRepository.save(rule));
    }

    @Transactional
    public MailRuleResponse update(MailPrincipal principal, UUID id, MailRuleRequest req) {
        MailAccount actor = loadActor(principal);
        MailRule rule = load(actor.getId(), id);
        List<MailRuleCondition> conditions = validateConditions(req.conditions());
        List<MailRuleAction> actions = validateActions(req.actions());
        rule.setName(validateName(req.name()));
        rule.setPriority(req.priority() != null ? req.priority() : rule.getPriority());
        rule.setEnabled(req.enabled() == null || req.enabled());
        rule.setMatchMode(req.matchMode() != null ? req.matchMode() : MailRuleMatchMode.ALL);
        rule.setStopProcessing(Boolean.TRUE.equals(req.stopProcessing()));
        rule.setConditionsJson(write(conditions));
        rule.setActionsJson(write(actions));
        return toResponse(ruleRepository.save(rule));
    }

    @Transactional
    public void delete(MailPrincipal principal, UUID id) {
        MailAccount actor = loadActor(principal);
        ruleRepository.delete(load(actor.getId(), id));
    }

    // ── validation ───────────────────────────────────────────────────────

    private String validateName(String name) {
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) {
            throw badRequest("Rule name is required", "MAIL_RULE_NAME_REQUIRED");
        }
        if (n.length() > MAX_NAME) {
            throw badRequest("Rule name is too long", "MAIL_RULE_NAME_TOO_LONG");
        }
        return n;
    }

    private List<MailRuleCondition> validateConditions(List<MailRuleCondition> in) {
        if (in == null || in.isEmpty()) {
            throw badRequest("At least one condition is required", "MAIL_RULE_NO_CONDITIONS");
        }
        if (in.size() > MAX_ITEMS) {
            throw badRequest("Too many conditions", "MAIL_RULE_TOO_MANY_CONDITIONS");
        }
        List<MailRuleCondition> out = new ArrayList<>(in.size());
        for (MailRuleCondition c : in) {
            if (c == null || c.field() == null || c.operator() == null) {
                throw badRequest("Condition field and operator are required", "MAIL_RULE_BAD_CONDITION");
            }
            if (c.field() == MailRuleField.HAS_ATTACHMENT) {
                if (c.operator() != MailRuleOperator.IS_TRUE) {
                    throw badRequest("HAS_ATTACHMENT must use IS_TRUE", "MAIL_RULE_BAD_CONDITION");
                }
                out.add(new MailRuleCondition(c.field(), MailRuleOperator.IS_TRUE, null));
            } else {
                if (c.operator() != MailRuleOperator.CONTAINS && c.operator() != MailRuleOperator.EQUALS) {
                    throw badRequest("This field needs CONTAINS or EQUALS", "MAIL_RULE_BAD_CONDITION");
                }
                String v = c.value() == null ? "" : c.value().trim();
                if (v.isEmpty()) {
                    throw badRequest("Condition value is required", "MAIL_RULE_BAD_CONDITION");
                }
                if (v.length() > MAX_VALUE) {
                    throw badRequest("Condition value is too long", "MAIL_RULE_BAD_CONDITION");
                }
                out.add(new MailRuleCondition(c.field(), c.operator(), v));
            }
        }
        return out;
    }

    private List<MailRuleAction> validateActions(List<MailRuleAction> in) {
        if (in == null || in.isEmpty()) {
            throw badRequest("At least one action is required", "MAIL_RULE_NO_ACTIONS");
        }
        if (in.size() > MAX_ITEMS) {
            throw badRequest("Too many actions", "MAIL_RULE_TOO_MANY_ACTIONS");
        }
        List<MailRuleAction> out = new ArrayList<>(in.size());
        for (MailRuleAction a : in) {
            if (a == null || a.type() == null) {
                throw badRequest("Action type is required", "MAIL_RULE_BAD_ACTION");
            }
            if (a.type() == MailRuleActionType.MOVE_TO_FOLDER) {
                MailFolder target = parseFolder(a.targetFolder());
                if (target == null || !MOVE_TARGETS.contains(target)) {
                    throw badRequest("MOVE_TO_FOLDER needs a target of INBOX, ARCHIVE, or TRASH",
                            "MAIL_RULE_BAD_ACTION");
                }
                out.add(new MailRuleAction(a.type(), target.name()));
            } else {
                out.add(new MailRuleAction(a.type(), null));
            }
        }
        return out;
    }

    private static MailFolder parseFolder(String s) {
        if (s == null) {
            return null;
        }
        try {
            return MailFolder.valueOf(s.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (RuntimeException e) {
            return null;
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private MailRule load(UUID accountId, UUID id) {
        return ruleRepository.findByIdAndAccountId(id, accountId)
                .orElseThrow(() -> new MailApiException(HttpStatus.NOT_FOUND, "Rule not found", "MAIL_NOT_FOUND"));
    }

    private MailAccount loadActor(MailPrincipal principal) {
        if (principal == null) {
            throw new MailApiException(HttpStatus.UNAUTHORIZED, "Authentication required", "MAIL_UNAUTHENTICATED");
        }
        return accountRepository.findById(principal.accountId())
                .orElseThrow(() -> new MailApiException(
                        HttpStatus.UNAUTHORIZED, "Authentication required", "MAIL_UNAUTHENTICATED"));
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw badRequest("Invalid rule payload", "MAIL_RULE_BAD_PAYLOAD");
        }
    }

    private MailRuleResponse toResponse(MailRule r) {
        return new MailRuleResponse(
                r.getId().toString(), r.getName(), r.getPriority(), r.isEnabled(),
                r.getMatchMode(), r.isStopProcessing(),
                read(r.getConditionsJson(), new TypeReference<List<MailRuleCondition>>() {
                }),
                read(r.getActionsJson(), new TypeReference<List<MailRuleAction>>() {
                }),
                r.getCreatedAt(), r.getUpdatedAt());
    }

    private <T> List<T> read(String json, TypeReference<List<T>> type) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            return List.of(); // never let one corrupt row break the listing
        }
    }

    private static MailApiException badRequest(String msg, String code) {
        return new MailApiException(HttpStatus.BAD_REQUEST, msg, code);
    }
}
