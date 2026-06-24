package com.skyzen.careers.mail;

import com.skyzen.careers.mail.auth.MailPrincipal;
import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.entity.MailAccountStatus;
import com.skyzen.careers.mail.entity.MailAttachment;
import com.skyzen.careers.mail.entity.MailDomain;
import com.skyzen.careers.mail.entity.MailFolder;
import com.skyzen.careers.mail.entity.MailMailboxEntry;
import com.skyzen.careers.mail.entity.MailMessage;
import com.skyzen.careers.mail.entity.MailRole;
import com.skyzen.careers.mail.exception.MailApiException;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import com.skyzen.careers.mail.repository.MailAttachmentRepository;
import com.skyzen.careers.mail.repository.MailMailboxEntryRepository;
import com.skyzen.careers.mail.repository.MailMessageRepository;
import com.skyzen.careers.mail.service.MailAttachmentService;
import com.skyzen.careers.mail.service.S3MailBlobStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Walling + IDOR + cap for attachments (DB/S3-free, mocked). */
class MailAttachmentServiceTest {

    private MailAttachmentRepository attachmentRepo;
    private MailMailboxEntryRepository entryRepo;
    private MailMessageRepository messageRepo;
    private MailAccountRepository accountRepo;
    private S3MailBlobStore blobStore;
    private MailAttachmentService service;

    private MailAccount alice;

    @BeforeEach
    void setUp() {
        attachmentRepo = mock(MailAttachmentRepository.class);
        entryRepo = mock(MailMailboxEntryRepository.class);
        messageRepo = mock(MailMessageRepository.class);
        accountRepo = mock(MailAccountRepository.class);
        blobStore = mock(S3MailBlobStore.class);
        service = new MailAttachmentService(attachmentRepo, entryRepo, messageRepo, accountRepo, blobStore);
        ReflectionTestUtils.setField(service, "maxBytes", 1024L);

        MailDomain dom = MailDomain.builder().id(UUID.randomUUID()).name("a.com").active(true).build();
        alice = MailAccount.builder().id(UUID.randomUUID()).domain(dom).localPart("alice")
                .role(MailRole.USER).status(MailAccountStatus.ACTIVE).passwordHash("x").build();
        when(accountRepo.findById(alice.getId())).thenReturn(Optional.of(alice));
        when(blobStore.isReady()).thenReturn(true);
    }

    private MailPrincipal principal(MailAccount a) {
        return new MailPrincipal(a.getId(), a.getLocalPart() + "@" + a.getDomain().getName(),
                a.getLocalPart(), a.getDomain().getId(), a.getRole(), false);
    }

    @Test
    void upload_toAnotherAccountsDraft_is404_noStore() {
        UUID draftId = UUID.randomUUID();
        // The draft is NOT the caller's → findByIdAndAccountId returns empty.
        when(entryRepo.findByIdAndAccountId(draftId, alice.getId())).thenReturn(Optional.empty());
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.upload(principal(alice), draftId, "f.txt", "text/plain", new byte[]{1, 2, 3}));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        verify(blobStore, never()).store(any());
    }

    @Test
    void upload_overCap_is413() {
        UUID draftId = UUID.randomUUID();
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.upload(principal(alice), draftId, "big.bin", "application/octet-stream",
                        new byte[2048])); // > 1024 cap
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, ex.getStatus());
        verify(blobStore, never()).store(any());
    }

    @Test
    void download_withoutMailboxEntry_is404_noFetch() {
        UUID attId = UUID.randomUUID();
        UUID msgId = UUID.randomUUID();
        when(attachmentRepo.findById(attId)).thenReturn(Optional.of(
                MailAttachment.builder().id(attId).messageId(msgId).filename("f").sizeBytes(3)
                        .storageKey("s3:k").build()));
        when(entryRepo.existsByAccountIdAndMessageId(alice.getId(), msgId)).thenReturn(false);
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.download(principal(alice), attId));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        verify(blobStore, never()).fetch(any());
    }

    @Test
    void upload_storageNotReady_is503() {
        when(blobStore.isReady()).thenReturn(false);
        UUID draftId = UUID.randomUUID();
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.upload(principal(alice), draftId, "f.txt", "text/plain", new byte[]{1}));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
    }

    @Test
    void upload_emptyFile_isBadRequest_noStore() {
        // Empty check fires before the draft lookup — no draft stub needed.
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.upload(principal(alice), UUID.randomUUID(), "f.txt", "text/plain", new byte[0]));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("MAIL_EMPTY_FILE", ex.getCode());
        verify(blobStore, never()).store(any());
    }

    @Test
    void delete_notOwnDraft_is404_noBlobDelete() {
        UUID attId = UUID.randomUUID();
        UUID msgId = UUID.randomUUID();
        when(attachmentRepo.findById(attId)).thenReturn(Optional.of(
                MailAttachment.builder().id(attId).messageId(msgId).filename("f").sizeBytes(1)
                        .storageKey("s3:k").build()));
        // No DRAFTS entry owned by the caller for that message → wall closes.
        when(entryRepo.findByAccountIdAndMessageIdAndFolder(alice.getId(), msgId, MailFolder.DRAFTS))
                .thenReturn(Optional.empty());
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.delete(principal(alice), attId));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        verify(blobStore, never()).delete(any());
    }

    @Test
    void upload_sanitizesFilename_andStripsPathTraversal() {
        UUID draftId = UUID.randomUUID();
        UUID msgId = UUID.randomUUID();
        MailMailboxEntry draft = MailMailboxEntry.builder()
                .id(draftId).accountId(alice.getId()).messageId(msgId).folder(MailFolder.DRAFTS).build();
        MailMessage msg = MailMessage.builder().id(msgId).build();
        when(entryRepo.findByIdAndAccountId(draftId, alice.getId())).thenReturn(Optional.of(draft));
        when(messageRepo.findById(msgId)).thenReturn(Optional.of(msg));
        when(blobStore.store(any())).thenReturn("s3:mail/attachments/x.bin");
        when(attachmentRepo.save(any())).thenAnswer(inv -> {
            MailAttachment a = inv.getArgument(0);
            if (a.getId() == null) a.setId(UUID.randomUUID());
            return a;
        });

        service.upload(principal(alice), draftId, "../../etc/passwd\"\n", "text/plain", new byte[]{1, 2});

        ArgumentCaptor<MailAttachment> cap = ArgumentCaptor.forClass(MailAttachment.class);
        verify(attachmentRepo).save(cap.capture());
        String saved = cap.getValue().getFilename();
        // Path separators stripped to the basename; CR/LF/quote neutralised.
        assertEquals("passwd_", saved);
        assertFalse(saved.contains("/"));
        assertFalse(saved.contains(".."));
        // The draft's message is flagged as having attachments.
        assertTrue(Boolean.TRUE.equals(msg.getHasAttachments()));
    }
}
