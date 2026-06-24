package com.skyzen.careers.mail;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.mail.dto.MailRuleAction;
import com.skyzen.careers.mail.dto.MailRuleActionType;
import com.skyzen.careers.mail.dto.MailRuleCondition;
import com.skyzen.careers.mail.dto.MailRuleField;
import com.skyzen.careers.mail.dto.MailRuleOperator;
import com.skyzen.careers.mail.entity.MailFolder;
import com.skyzen.careers.mail.entity.MailRule;
import com.skyzen.careers.mail.entity.MailRuleMatchMode;
import com.skyzen.careers.mail.repository.MailRuleRepository;
import com.skyzen.careers.mail.service.MailRuleEngine;
import com.skyzen.careers.mail.service.MailRuleEngine.DeliveryDecision;
import com.skyzen.careers.mail.service.MailRuleEngine.RuleContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Rule evaluation: conditions, actions, match modes, stop-processing, FAIL-OPEN. */
class MailRuleEngineTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private MailRuleRepository repo;
    private MailRuleEngine engine;
    private final UUID acct = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        repo = mock(MailRuleRepository.class);
        engine = new MailRuleEngine(repo, mapper);
    }

    private MailRule rule(int priority, boolean stop, MailRuleMatchMode mode,
                          List<MailRuleCondition> conds, List<MailRuleAction> actions) {
        try {
            return MailRule.builder().id(UUID.randomUUID()).accountId(acct).name("r")
                    .priority(priority).enabled(true).matchMode(mode).stopProcessing(stop)
                    .conditionsJson(mapper.writeValueAsString(conds))
                    .actionsJson(mapper.writeValueAsString(actions))
                    .build();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void stub(MailRule... rules) {
        when(repo.findByAccountIdAndEnabledTrueOrderByPriorityAscCreatedAtAsc(acct))
                .thenReturn(List.of(rules));
    }

    private RuleContext ctx(boolean hasAttachment) {
        return new RuleContext("boss@a.com", List.of("me@a.com"), List.of("team@a.com"),
                "Quarterly report", hasAttachment);
    }

    private static MailRuleCondition cond(MailRuleField f, MailRuleOperator op, String v) {
        return new MailRuleCondition(f, op, v);
    }

    private static MailRuleAction act(MailRuleActionType t, String folder) {
        return new MailRuleAction(t, folder);
    }

    @Test
    void noRules_defaultsToInbox() {
        when(repo.findByAccountIdAndEnabledTrueOrderByPriorityAscCreatedAtAsc(acct)).thenReturn(List.of());
        DeliveryDecision d = engine.resolveDelivery(acct, ctx(false));
        assertEquals(MailFolder.INBOX, d.folder());
        assertFalse(d.read() || d.starred() || d.important());
    }

    @Test
    void fromContains_movesToArchive() {
        stub(rule(100, false, MailRuleMatchMode.ALL,
                List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                List.of(act(MailRuleActionType.MOVE_TO_FOLDER, "ARCHIVE"))));
        assertEquals(MailFolder.ARCHIVE, engine.resolveDelivery(acct, ctx(false)).folder());
    }

    @Test
    void allMode_requiresEveryCondition() {
        stub(rule(100, false, MailRuleMatchMode.ALL,
                List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss"),
                        cond(MailRuleField.SUBJECT, MailRuleOperator.CONTAINS, "invoice")),
                List.of(act(MailRuleActionType.STAR, null))));
        // subject is "Quarterly report" — second condition fails → no match.
        assertFalse(engine.resolveDelivery(acct, ctx(false)).starred());
    }

    @Test
    void anyMode_oneConditionSuffices() {
        stub(rule(100, false, MailRuleMatchMode.ANY,
                List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "nomatch"),
                        cond(MailRuleField.SUBJECT, MailRuleOperator.CONTAINS, "quarterly")),
                List.of(act(MailRuleActionType.MARK_IMPORTANT, null))));
        assertTrue(engine.resolveDelivery(acct, ctx(false)).important());
    }

    @Test
    void toCondition_matchesRecipientList() {
        stub(rule(100, false, MailRuleMatchMode.ALL,
                List.of(cond(MailRuleField.TO, MailRuleOperator.CONTAINS, "me@a.com")),
                List.of(act(MailRuleActionType.STAR, null))));
        assertTrue(engine.resolveDelivery(acct, ctx(false)).starred());
    }

    @Test
    void hasAttachment_isTrue() {
        stub(rule(100, false, MailRuleMatchMode.ALL,
                List.of(cond(MailRuleField.HAS_ATTACHMENT, MailRuleOperator.IS_TRUE, null)),
                List.of(act(MailRuleActionType.STAR, null))));
        assertTrue(engine.resolveDelivery(acct, ctx(true)).starred());
        assertFalse(engine.resolveDelivery(acct, ctx(false)).starred());
    }

    @Test
    void multipleActions_combine() {
        stub(rule(100, false, MailRuleMatchMode.ALL,
                List.of(cond(MailRuleField.FROM, MailRuleOperator.EQUALS, "boss@a.com")),
                List.of(act(MailRuleActionType.MARK_READ, null),
                        act(MailRuleActionType.STAR, null),
                        act(MailRuleActionType.MARK_IMPORTANT, null))));
        DeliveryDecision d = engine.resolveDelivery(acct, ctx(false));
        assertTrue(d.read() && d.starred() && d.important());
    }

    @Test
    void delete_movesToTrash_notDropped() {
        stub(rule(100, false, MailRuleMatchMode.ALL,
                List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                List.of(act(MailRuleActionType.DELETE, null))));
        assertEquals(MailFolder.TRASH, engine.resolveDelivery(acct, ctx(false)).folder());
    }

    @Test
    void stopProcessing_haltsLowerPriorityRules() {
        // rule1 (priority 1, stop) archives; rule2 (priority 2) would trash.
        stub(rule(1, true, MailRuleMatchMode.ALL,
                        List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                        List.of(act(MailRuleActionType.MOVE_TO_FOLDER, "ARCHIVE"))),
                rule(2, false, MailRuleMatchMode.ALL,
                        List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                        List.of(act(MailRuleActionType.MOVE_TO_FOLDER, "TRASH"))));
        assertEquals(MailFolder.ARCHIVE, engine.resolveDelivery(acct, ctx(false)).folder());
    }

    @Test
    void withoutStop_laterRuleOverrides() {
        stub(rule(1, false, MailRuleMatchMode.ALL,
                        List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                        List.of(act(MailRuleActionType.MOVE_TO_FOLDER, "ARCHIVE"))),
                rule(2, false, MailRuleMatchMode.ALL,
                        List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                        List.of(act(MailRuleActionType.MOVE_TO_FOLDER, "TRASH"))));
        assertEquals(MailFolder.TRASH, engine.resolveDelivery(acct, ctx(false)).folder());
    }

    @Test
    void failOpen_malformedRuleSkipped_othersApply() {
        MailRule bad = MailRule.builder().id(UUID.randomUUID()).accountId(acct).name("bad")
                .priority(1).enabled(true).matchMode(MailRuleMatchMode.ALL).stopProcessing(false)
                .conditionsJson("{not valid json").actionsJson("[]").build();
        MailRule good = rule(2, false, MailRuleMatchMode.ALL,
                List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                List.of(act(MailRuleActionType.STAR, null)));
        stub(bad, good);
        DeliveryDecision d = engine.resolveDelivery(acct, ctx(false));
        assertTrue(d.starred(), "the valid rule still applies");
        assertEquals(MailFolder.INBOX, d.folder());
    }

    @Test
    void failOpen_repositoryError_defaultsToInbox() {
        when(repo.findByAccountIdAndEnabledTrueOrderByPriorityAscCreatedAtAsc(acct))
                .thenThrow(new RuntimeException("db down"));
        DeliveryDecision d = engine.resolveDelivery(acct, ctx(false));
        assertEquals(MailFolder.INBOX, d.folder());
        assertFalse(d.read() || d.starred() || d.important());
    }
}
