package com.skyzen.careers.mail;

import com.skyzen.careers.mail.auth.MailPrincipal;
import com.skyzen.careers.mail.dto.MailCustomFolderRequest;
import com.skyzen.careers.mail.dto.MailCustomFolderResponse;
import com.skyzen.careers.mail.entity.MailAccount;
import com.skyzen.careers.mail.entity.MailAccountStatus;
import com.skyzen.careers.mail.entity.MailCustomFolder;
import com.skyzen.careers.mail.entity.MailDomain;
import com.skyzen.careers.mail.entity.MailFolder;
import com.skyzen.careers.mail.entity.MailMailboxEntry;
import com.skyzen.careers.mail.entity.MailRole;
import com.skyzen.careers.mail.exception.MailApiException;
import com.skyzen.careers.mail.repository.MailAccountRepository;
import com.skyzen.careers.mail.repository.MailCustomFolderRepository;
import com.skyzen.careers.mail.repository.MailMailboxEntryRepository;
import com.skyzen.careers.mail.service.MailCustomFolderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Walled CRUD + delete-to-Trash for custom folders (DB-free, mocked). */
class MailCustomFolderServiceTest {

    private MailCustomFolderRepository folderRepo;
    private MailAccountRepository accountRepo;
    private MailMailboxEntryRepository entryRepo;
    private MailCustomFolderService service;
    private MailAccount alice;

    @BeforeEach
    void setUp() {
        folderRepo = mock(MailCustomFolderRepository.class);
        accountRepo = mock(MailAccountRepository.class);
        entryRepo = mock(MailMailboxEntryRepository.class);
        service = new MailCustomFolderService(folderRepo, accountRepo, entryRepo);
        MailDomain dom = MailDomain.builder().id(UUID.randomUUID()).name("a.com").active(true).build();
        alice = MailAccount.builder().id(UUID.randomUUID()).domain(dom).localPart("alice")
                .role(MailRole.USER).status(MailAccountStatus.ACTIVE).passwordHash("x").build();
        when(accountRepo.findById(alice.getId())).thenReturn(Optional.of(alice));
        when(folderRepo.save(any())).thenAnswer(inv -> {
            MailCustomFolder f = inv.getArgument(0);
            if (f.getId() == null) f.setId(UUID.randomUUID());
            return f;
        });
    }

    private MailPrincipal principal() {
        return new MailPrincipal(alice.getId(), "alice@a.com", "alice", alice.getDomain().getId(),
                alice.getRole(), false);
    }

    @Test
    void create_valid_persists() {
        when(folderRepo.countByAccountId(alice.getId())).thenReturn(0L);
        when(folderRepo.existsByAccountIdAndNameIgnoreCase(alice.getId(), "Receipts")).thenReturn(false);
        MailCustomFolderResponse res = service.create(principal(), new MailCustomFolderRequest("  Receipts "));
        assertEquals("Receipts", res.name());
    }

    @Test
    void create_duplicate_is409() {
        when(folderRepo.countByAccountId(alice.getId())).thenReturn(1L);
        when(folderRepo.existsByAccountIdAndNameIgnoreCase(alice.getId(), "Receipts")).thenReturn(true);
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.create(principal(), new MailCustomFolderRequest("Receipts")));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        verify(folderRepo, never()).save(any());
    }

    @Test
    void create_blankName_is400() {
        when(folderRepo.countByAccountId(alice.getId())).thenReturn(0L);
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.create(principal(), new MailCustomFolderRequest("   ")));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void create_overLimit_is400() {
        when(folderRepo.countByAccountId(alice.getId())).thenReturn(50L);
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.create(principal(), new MailCustomFolderRequest("Receipts")));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("MAIL_FOLDER_LIMIT", ex.getCode());
    }

    @Test
    void rename_foreignFolder_is404() {
        UUID id = UUID.randomUUID();
        when(folderRepo.findByIdAndAccountId(id, alice.getId())).thenReturn(Optional.empty());
        MailApiException ex = assertThrows(MailApiException.class, () ->
                service.rename(principal(), id, new MailCustomFolderRequest("New name")));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
    }

    @Test
    void delete_foreignFolder_is404_noChanges() {
        UUID id = UUID.randomUUID();
        when(folderRepo.findByIdAndAccountId(id, alice.getId())).thenReturn(Optional.empty());
        MailApiException ex = assertThrows(MailApiException.class, () -> service.delete(principal(), id));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        verify(folderRepo, never()).delete(any());
    }

    @Test
    void delete_movesMessagesToTrash_clearsFk_thenRemovesFolder() {
        UUID id = UUID.randomUUID();
        MailCustomFolder folder = MailCustomFolder.builder().id(id).accountId(alice.getId()).name("Receipts").build();
        when(folderRepo.findByIdAndAccountId(id, alice.getId())).thenReturn(Optional.of(folder));
        MailMailboxEntry e1 = MailMailboxEntry.builder().id(UUID.randomUUID()).accountId(alice.getId())
                .messageId(UUID.randomUUID()).folder(MailFolder.INBOX).customFolderId(id).build();
        MailMailboxEntry e2 = MailMailboxEntry.builder().id(UUID.randomUUID()).accountId(alice.getId())
                .messageId(UUID.randomUUID()).folder(MailFolder.INBOX).customFolderId(id).build();
        when(entryRepo.findByAccountIdAndCustomFolderId(alice.getId(), id)).thenReturn(List.of(e1, e2));

        service.delete(principal(), id);

        for (MailMailboxEntry e : List.of(e1, e2)) {
            assertNull(e.getCustomFolderId(), "FK cleared");
            assertEquals(MailFolder.TRASH, e.getFolder(), "moved to Trash (recoverable)");
        }
        verify(entryRepo).saveAll(any());
        verify(folderRepo).delete(folder);
    }
}
