package com.skyzen.careers.mail.dto;

/** Attachment metadata for the message detail / upload response. No storage key. */
public record MailAttachmentResponse(
        String id,
        String filename,
        String contentType,
        long sizeBytes
) {
}
