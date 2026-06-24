package com.skyzen.careers.mail.repository;

import com.skyzen.careers.mail.entity.MailFolder;
import com.skyzen.careers.mail.entity.MailMailboxEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MailMailboxEntryRepository extends JpaRepository<MailMailboxEntry, UUID> {

    /** Walled fetch — only the caller's own entry. */
    Optional<MailMailboxEntry> findByIdAndAccountId(UUID id, UUID accountId);

    // ── System-folder placement (precedence: custom_folder_id MUST be null, else
    //    the entry lives in its custom folder, not its system enum) ────────────
    Page<MailMailboxEntry> findByAccountIdAndFolderAndCustomFolderIdIsNullAndDeletedAtIsNull(
            UUID accountId, MailFolder folder, Pageable pageable);

    long countByAccountIdAndFolderAndCustomFolderIdIsNullAndDeletedAtIsNull(
            UUID accountId, MailFolder folder);

    long countByAccountIdAndFolderAndCustomFolderIdIsNullAndDeletedAtIsNullAndIsReadFalse(
            UUID accountId, MailFolder folder);

    // ── Custom-folder placement ───────────────────────────────────────────────
    Page<MailMailboxEntry> findByAccountIdAndCustomFolderIdAndDeletedAtIsNull(
            UUID accountId, UUID customFolderId, Pageable pageable);

    long countByAccountIdAndCustomFolderIdAndDeletedAtIsNull(UUID accountId, UUID customFolderId);

    long countByAccountIdAndCustomFolderIdAndDeletedAtIsNullAndIsReadFalse(
            UUID accountId, UUID customFolderId);

    /** All of the caller's entries in a custom folder (for delete-folder → Trash). */
    List<MailMailboxEntry> findByAccountIdAndCustomFolderId(UUID accountId, UUID customFolderId);

    Page<MailMailboxEntry> findByAccountIdAndIsStarredTrueAndDeletedAtIsNull(
            UUID accountId, Pageable pageable);

    Optional<MailMailboxEntry> findByAccountIdAndMessageIdAndFolder(
            UUID accountId, UUID messageId, MailFolder folder);

    boolean existsByAccountIdAndMessageId(UUID accountId, UUID messageId);

    /** The caller's live entries within a thread (for the thread view). */
    List<MailMailboxEntry> findByAccountIdAndMessageIdInAndDeletedAtIsNull(
            UUID accountId, Collection<UUID> messageIds);

    /** Bounded scan for search (Pageable caps the candidate set; TRASH excluded). */
    List<MailMailboxEntry> findByAccountIdAndDeletedAtIsNullAndFolderNot(
            UUID accountId, MailFolder folder, Pageable pageable);
}
