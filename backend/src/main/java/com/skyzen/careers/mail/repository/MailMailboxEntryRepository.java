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

    Page<MailMailboxEntry> findByAccountIdAndFolderAndDeletedAtIsNull(
            UUID accountId, MailFolder folder, Pageable pageable);

    Page<MailMailboxEntry> findByAccountIdAndIsStarredTrueAndDeletedAtIsNull(
            UUID accountId, Pageable pageable);

    long countByAccountIdAndFolderAndDeletedAtIsNull(UUID accountId, MailFolder folder);

    long countByAccountIdAndFolderAndDeletedAtIsNullAndIsReadFalse(UUID accountId, MailFolder folder);

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
