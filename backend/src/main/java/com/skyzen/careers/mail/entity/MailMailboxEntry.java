package com.skyzen.careers.mail.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * One participant's per-folder view of a message — the unit everything the
 * caller sees/acts on. A participant has at most one entry per (message, folder)
 * — e.g. a sender who CC's themselves gets both a SENT and an INBOX entry.
 * {@code deletedAt} tombstones a permanently-removed own entry (excluded from
 * all folder listings; full message purge is a later phase).
 */
@Entity
@Table(name = "mail_mailbox_entries",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_mail_entry_account_message_folder",
                columnNames = {"account_id", "message_id", "folder"}),
        indexes = {
                @Index(name = "idx_mail_entry_account_folder", columnList = "account_id, folder"),
                @Index(name = "idx_mail_entry_account_message", columnList = "account_id, message_id"),
                @Index(name = "idx_mail_entry_message", columnList = "message_id"),
                @Index(name = "idx_mail_entry_account_custom_folder", columnList = "account_id, custom_folder_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MailMailboxEntry {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private MailFolder folder;

    /**
     * When non-null, this entry lives in the referenced custom folder and its
     * {@link #folder} enum is IGNORED for placement (precedence: custom over
     * system). When null, placement falls back to {@link #folder} (default
     * behaviour). NOT a JPA association — a plain FK id, like account/message.
     */
    @Column(name = "custom_folder_id")
    private UUID customFolderId;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private Boolean isRead = Boolean.FALSE;

    @Column(name = "is_starred", nullable = false)
    @Builder.Default
    private Boolean isStarred = Boolean.FALSE;

    @Column(name = "is_important", nullable = false)
    @Builder.Default
    private Boolean isImportant = Boolean.FALSE;

    /** Tombstone for a permanently-removed own entry (excluded from listings). */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
