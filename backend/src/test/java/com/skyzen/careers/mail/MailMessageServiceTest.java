package com.skyzen.careers.mail;

import com.skyzen.careers.mail.auth.MailPrincipal;
import com.skyzen.careers.mail.dto.MailMessageDetail;
import com.skyzen.careers.mail.dto.MailSendRequest;
import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.entity.MailAccountStatus;
import com.skyzen.careers.mail.entity.MailDomain;
import com.skyzen.careers.mail.entity.MailFolder;
import com.skyzen.careers.mail.entity.MailMailboxEntry;
import com.skyzen.careers.mail.entity.MailMessage;
import com.skyzen.careers.mail.entity.MailMessageRecipient;
import com.skyzen.careers.mail.entity.MailRecipientType;
import com.skyzen.careers.mail.entity.MailRole;
import com.skyzen.careers.mail.exception.MailApiException;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import com.skyzen.careers.mail.repository.MailAttachmentRepository;
import com.skyzen.careers.mail.repository.MailMailboxEntryRepository;
import com.skyzen.careers.mail.repository.MailMessageRecipientRepository;
import com.skyzen.careers.mail.repository.MailMessageRepository;
import com.skyzen.careers.mail.service.MailMessageService;
import com.skyzen.careers.mail.service.MailRuleEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * DB-free unit tests for the mail core invariants: same-domain walled send,
 * delivery shape (sender SENT + recipient unread INBOX), single-row sendDraft
 * (no duplicate SENT), walling 404, and BCC visibility. The encrypted-at-rest
 * round-trip is NOT covered here (it needs a live DB + the JPA converter) and is
 * reported UNVERIFIED.
 */
class MailMessageServiceTest {

    private MailMessageRepository messageRepo;
    private MailMessageRecipientRepository recipientRepo;
    private MailMailboxEntryRepository entryRepo;
    private MailAccountRepository accountRepo;
    private MailAttachmentRepository attachmentRepo;
    private MailRuleEngine ruleEngine;
    private MailMessageService service;

    private MailDomain domA;
    private MailDomain domB;
    private MailAccount alice;
    private MailAccount bob;
    private MailAccount dave;

    @BeforeEach
    void setUp() {
        messageRepo = mock(MailMessageRepository.class);
        recipientRepo = mock(MailMessageRecipientRepository.class);
        entryRepo = mock(MailMailboxEntryRepository.class);
        accountRepo = mock(MailAccountRepository.class);
        attachmentRepo = mock(MailAttachmentRepository.class);
        ruleEngine = mock(MailRuleEngine.class);
        // Default: no rules → INBOX/unread, so existing delivery assertions hold.
        when(ruleEngine.resolveDelivery(any(), any())).thenReturn(MailRuleEngine.DeliveryDecision.inbox());
        service = new MailMessageService(messageRepo, recipientRepo, entryRepo, accountRepo, attachmentRepo, ruleEngine);
        ReflectionTestUtils.setField(service, "maxSubject", 500);
        ReflectionTestUtils.setField(service, "maxBody", 100000);
        ReflectionTestUtils.setField(service, "maxRecipients", 100);
        ReflectionTestUtils.setField(service, "defaultPageSize", 25);
        ReflectionTestUtils.setField(service, "maxPageSize", 100);
        ReflectionTestUtils.setField(service, "searchScanCap", 500);

        domA = MailDomain.builder().id(UUID.randomUUID()).name("a.com").active(true).build();
        domB = MailDomain.builder().id(UUID.randomUUID()).name("b.com").active(true).build();
        alice = account(domA, "alice");
        bob = account(domA, "bob");
        dave = account(domA, "dave");

        when(accountRepo.findById(alice.getId())).thenReturn(Optional.of(alice));
        when(messageRepo.save(any())).thenAnswer(inv -> {
            MailMessage m = inv.getArgument(0);
            if (m.getId() == null) m.setId(UUID.randomUUID());
            return m;
        });
        when(entryRepo.save(any())).thenAnswer(inv -> {
            MailMailboxEntry e = inv.getArgument(0);
            if (e.getId() == null) e.setId(UUID.randomUUID());
            return e;
        });
        when(recipientRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private MailAccount account(MailDomain domain, String localPart) {
        return MailAccount.builder()
                .id(UUID.randomUUID()).domain(domain).localPart(localPart)
                .displayName(localPart).passwordHash("x")
                .role(MailRole.USER).status(MailAccountStatus.ACTIVE)
                .build();
    }

    private MailPrincipal principal(MailAccount a) {
        return new MailPrincipal(a.getId(), a.getLocalPart() + "@" + a.getDomain().getName(),
                a.getDisplayName(), a.getDomain().getId(), a.getRole(), false);
    }

    @Test
    void send_sameDomain_createsSentForSenderAndUnreadInboxForRecipient() {
        when(accountRepo.findByLocalPartAndDomain_Id("bob", domA.getId())).thenReturn(Optional.of(bob));
        when(recipientRepo.findByMessageId(any()))
                .thenReturn(List.of(recipient(bob, MailRecipientType.TO)));
        when(accountRepo.findAllById(any())).thenReturn(List.of(alice, bob));

        MailMessageDetail detail = service.send(principal(alice),
                new MailSendRequest(List.of("bob"), null, null, "Hi", "hello", null, null));

        ArgumentCaptor<MailMailboxEntry> cap = ArgumentCaptor.forClass(MailMailboxEntry.class);
        verify(entryRepo, org.mockito.Mockito.atLeastOnce()).save(cap.capture());
        List<MailMailboxEntry> saved = cap.getAllValues();
        MailMailboxEntry sent = saved.stream()
                .filter(e -> e.getFolder() == MailFolder.SENT).findFirst().orElseThrow();
        MailMailboxEntry inbox = saved.stream()
                .filter(e -> e.getFolder() == MailFolder.INBOX).findFirst().orElseThrow();
        assertEquals(alice.getId(), sent.getAccountId());
        assertTrue(Boolean.TRUE.equals(sent.getIsRead()));
        assertEquals(bob.getId(), inbox.getAccountId());
        assertFalse(Boolean.TRUE.equals(inbox.getIsRead()), "recipient INBOX must be unread");
        assertEquals("alice@a.com", detail.from().email());
    }

    @Test
    void send_crossDomain_rejected_nothingDelivered() {
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.send(principal(alice),
                        new MailSendRequest(List.of("carol@b.com"), null, null, "Hi", "x", null, null)));
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, ex.getStatus());
        assertEquals("MAIL_RECIPIENT_INVALID", ex.getCode());
        verify(messageRepo, never()).save(any());
        verify(entryRepo, never()).save(any());
        verify(recipientRepo, never()).save(any());
    }

    @Test
    void send_unknownRecipient_rejected() {
        when(accountRepo.findByLocalPartAndDomain_Id("ghost", domA.getId())).thenReturn(Optional.empty());
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.send(principal(alice),
                        new MailSendRequest(List.of("ghost"), null, null, "Hi", "x", null, null)));
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, ex.getStatus());
        verify(entryRepo, never()).save(any());
    }

    @Test
    void sendDraft_transitionsSameEntryToSent_noDuplicateSent() {
        UUID msgId = UUID.randomUUID();
        UUID entryId = UUID.randomUUID();
        MailMessage draft = MailMessage.builder()
                .id(msgId).senderAccountId(alice.getId()).subject("Draft")
                .bodyText("body").threadId(msgId).draftTo("bob").hasAttachments(false).build();
        MailMailboxEntry draftEntry = MailMailboxEntry.builder()
                .id(entryId).accountId(alice.getId()).messageId(msgId)
                .folder(MailFolder.DRAFTS).isRead(true).build();
        when(entryRepo.findByIdAndAccountId(entryId, alice.getId())).thenReturn(Optional.of(draftEntry));
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(draft));
        when(accountRepo.findByLocalPartAndDomain_Id("bob", domA.getId())).thenReturn(Optional.of(bob));
        when(recipientRepo.findByMessageId(any())).thenReturn(List.of(recipient(bob, MailRecipientType.TO)));
        when(accountRepo.findAllById(any())).thenReturn(List.of(alice, bob));

        service.sendDraft(principal(alice), entryId, null);

        ArgumentCaptor<MailMailboxEntry> cap = ArgumentCaptor.forClass(MailMailboxEntry.class);
        verify(entryRepo, org.mockito.Mockito.atLeastOnce()).save(cap.capture());
        List<MailMailboxEntry> sentEntries = cap.getAllValues().stream()
                .filter(e -> e.getFolder() == MailFolder.SENT).toList();
        assertEquals(1, sentEntries.size(), "exactly one SENT entry (the transitioned draft)");
        assertEquals(entryId, sentEntries.get(0).getId(), "the SAME draft row became SENT");
        // and the recipient got an unread INBOX entry
        assertTrue(cap.getAllValues().stream().anyMatch(
                e -> e.getFolder() == MailFolder.INBOX && e.getAccountId().equals(bob.getId())));
    }

    @Test
    void getEntry_noEntryForCaller_is404() {
        UUID entryId = UUID.randomUUID();
        when(entryRepo.findByIdAndAccountId(eq(entryId), eq(alice.getId()))).thenReturn(Optional.empty());
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.getEntry(principal(alice), entryId));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
    }

    @Test
    void detail_bccHiddenFromToRecipient_visibleToSender() {
        UUID msgId = UUID.randomUUID();
        MailMessage msg = MailMessage.builder()
                .id(msgId).senderAccountId(alice.getId()).subject("S").bodyText("b")
                .threadId(msgId).hasAttachments(false).build();
        List<MailMessageRecipient> recips = List.of(
                recipient(bob, MailRecipientType.TO), recipient(dave, MailRecipientType.BCC));
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));
        when(recipientRepo.findByMessageId(msgId)).thenReturn(recips);
        when(accountRepo.findAllById(any())).thenReturn(List.of(alice, bob, dave));

        // Caller = bob (a TO recipient): must NOT see the BCC line.
        UUID bobEntryId = UUID.randomUUID();
        when(accountRepo.findById(bob.getId())).thenReturn(Optional.of(bob));
        when(entryRepo.findByIdAndAccountId(bobEntryId, bob.getId())).thenReturn(Optional.of(
                MailMailboxEntry.builder().id(bobEntryId).accountId(bob.getId()).messageId(msgId)
                        .folder(MailFolder.INBOX).isRead(false).build()));
        MailMessageDetail asBob = service.getEntry(principal(bob), bobEntryId);
        assertTrue(asBob.bcc() == null || asBob.bcc().isEmpty(), "TO recipient must not see BCC");
        assertEquals(1, asBob.to().size());

        // Caller = alice (sender): sees the BCC line.
        UUID aliceEntryId = UUID.randomUUID();
        when(entryRepo.findByIdAndAccountId(aliceEntryId, alice.getId())).thenReturn(Optional.of(
                MailMailboxEntry.builder().id(aliceEntryId).accountId(alice.getId()).messageId(msgId)
                        .folder(MailFolder.SENT).isRead(true).build()));
        MailMessageDetail asAlice = service.getEntry(principal(alice), aliceEntryId);
        assertEquals(1, asAlice.bcc().size(), "sender sees BCC");
        assertEquals("dave@a.com", asAlice.bcc().get(0).email());
    }

    private MailMessageRecipient recipient(MailAccount a, MailRecipientType type) {
        return MailMessageRecipient.builder()
                .id(UUID.randomUUID()).messageId(UUID.randomUUID())
                .recipientAccountId(a.getId()).recipientType(type).build();
    }
}
