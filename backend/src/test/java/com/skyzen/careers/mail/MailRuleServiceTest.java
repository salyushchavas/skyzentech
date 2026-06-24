package com.skyzen.careers.mail;

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
import com.skyzen.careers.mail.entity.MailAccountStatus;
import com.skyzen.careers.mail.entity.MailDomain;
import com.skyzen.careers.mail.entity.MailRule;
import com.skyzen.careers.mail.entity.MailRuleMatchMode;
import com.skyzen.careers.mail.entity.MailRole;
import com.skyzen.careers.mail.exception.MailApiException;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import com.skyzen.careers.mail.repository.MailCustomFolderRepository;
import com.skyzen.careers.mail.repository.MailRuleRepository;
import com.skyzen.careers.mail.service.MailRuleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Walled CRUD + validation for inbox rules (DB-free, mocked). */
class MailRuleServiceTest {

    private MailRuleRepository ruleRepo;
    private MailAccountRepository accountRepo;
    private MailCustomFolderRepository customFolderRepo;
    private MailRuleService service;
    private MailAccount alice;

    @BeforeEach
    void setUp() {
        ruleRepo = mock(MailRuleRepository.class);
        accountRepo = mock(MailAccountRepository.class);
        customFolderRepo = mock(MailCustomFolderRepository.class);
        service = new MailRuleService(ruleRepo, accountRepo, customFolderRepo, new ObjectMapper());
        MailDomain dom = MailDomain.builder().id(UUID.randomUUID()).name("a.com").active(true).build();
        alice = MailAccount.builder().id(UUID.randomUUID()).domain(dom).localPart("alice")
                .role(MailRole.USER).status(MailAccountStatus.ACTIVE).passwordHash("x").build();
        when(accountRepo.findById(alice.getId())).thenReturn(Optional.of(alice));
        when(ruleRepo.save(any())).thenAnswer(inv -> {
            MailRule r = inv.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            return r;
        });
    }

    private MailPrincipal principal() {
        return new MailPrincipal(alice.getId(), "alice@a.com", "alice", alice.getDomain().getId(),
                alice.getRole(), false);
    }

    private MailRuleRequest req(List<MailRuleCondition> conds, List<MailRuleAction> actions) {
        return new MailRuleRequest("My rule", 50, true, MailRuleMatchMode.ALL, false, conds, actions);
    }

    private static MailRuleCondition cond(MailRuleField f, MailRuleOperator op, String v) {
        return new MailRuleCondition(f, op, v);
    }

    private static MailRuleAction act(MailRuleActionType t, String folder) {
        return new MailRuleAction(t, folder, null);
    }

    @Test
    void create_valid_persistsAndRoundTrips() {
        when(ruleRepo.countByAccountId(alice.getId())).thenReturn(0L);
        MailRuleResponse res = service.create(principal(), req(
                List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                List.of(act(MailRuleActionType.MOVE_TO_FOLDER, "ARCHIVE"))));
        assertEquals(1, res.conditions().size());
        assertEquals(MailRuleField.FROM, res.conditions().get(0).field());
        assertEquals("ARCHIVE", res.actions().get(0).targetFolder());
    }

    @Test
    void create_noConditions_is400() {
        when(ruleRepo.countByAccountId(alice.getId())).thenReturn(0L);
        MailApiException ex = assertThrows(MailApiException.class, () -> service.create(principal(),
                req(List.of(), List.of(act(MailRuleActionType.STAR, null)))));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        verify(ruleRepo, never()).save(any());
    }

    @Test
    void create_hasAttachmentWithContains_is400() {
        when(ruleRepo.countByAccountId(alice.getId())).thenReturn(0L);
        MailApiException ex = assertThrows(MailApiException.class, () -> service.create(principal(),
                req(List.of(cond(MailRuleField.HAS_ATTACHMENT, MailRuleOperator.CONTAINS, "x")),
                        List.of(act(MailRuleActionType.STAR, null)))));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void create_moveWithoutTarget_is400() {
        when(ruleRepo.countByAccountId(alice.getId())).thenReturn(0L);
        MailApiException ex = assertThrows(MailApiException.class, () -> service.create(principal(),
                req(List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                        List.of(act(MailRuleActionType.MOVE_TO_FOLDER, null)))));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void create_moveToSent_is400() {
        when(ruleRepo.countByAccountId(alice.getId())).thenReturn(0L);
        MailApiException ex = assertThrows(MailApiException.class, () -> service.create(principal(),
                req(List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                        List.of(act(MailRuleActionType.MOVE_TO_FOLDER, "SENT")))));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void create_blankName_is400() {
        when(ruleRepo.countByAccountId(alice.getId())).thenReturn(0L);
        MailRuleRequest r = new MailRuleRequest("   ", 50, true, MailRuleMatchMode.ALL, false,
                List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                List.of(act(MailRuleActionType.STAR, null)));
        MailApiException ex = assertThrows(MailApiException.class, () -> service.create(principal(), r));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void create_overRuleLimit_is400() {
        when(ruleRepo.countByAccountId(alice.getId())).thenReturn(100L);
        MailApiException ex = assertThrows(MailApiException.class, () -> service.create(principal(),
                req(List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                        List.of(act(MailRuleActionType.STAR, null)))));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("MAIL_RULE_LIMIT", ex.getCode());
        verify(ruleRepo, never()).save(any());
    }

    @Test
    void get_foreignRule_is404() {
        UUID id = UUID.randomUUID();
        when(ruleRepo.findByIdAndAccountId(id, alice.getId())).thenReturn(Optional.empty());
        MailApiException ex = assertThrows(MailApiException.class, () -> service.get(principal(), id));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
    }

    @Test
    void update_foreignRule_is404_noSave() {
        UUID id = UUID.randomUUID();
        when(ruleRepo.findByIdAndAccountId(id, alice.getId())).thenReturn(Optional.empty());
        MailApiException ex = assertThrows(MailApiException.class, () -> service.update(principal(), id,
                req(List.of(cond(MailRuleField.FROM, MailRuleOperator.CONTAINS, "boss")),
                        List.of(act(MailRuleActionType.STAR, null)))));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        verify(ruleRepo, never()).save(any());
    }

    @Test
    void delete_foreignRule_is404_noDelete() {
        UUID id = UUID.randomUUID();
        when(ruleRepo.findByIdAndAccountId(id, alice.getId())).thenReturn(Optional.empty());
        MailApiException ex = assertThrows(MailApiException.class, () -> service.delete(principal(), id));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        verify(ruleRepo, never()).delete(any());
    }
}
