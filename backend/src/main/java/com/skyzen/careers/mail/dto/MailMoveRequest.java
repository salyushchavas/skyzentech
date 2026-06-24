package com.skyzen.careers.mail.dto;

/**
 * Move an entry: either to a system folder (one of the MailFolder names) OR to a
 * custom folder by id. When {@code customFolderId} is present it wins; otherwise
 * {@code folder} (a system enum name) is required.
 */
public record MailMoveRequest(
        String folder,
        String customFolderId
) {
}
