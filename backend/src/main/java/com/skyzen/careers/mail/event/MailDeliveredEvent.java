package com.skyzen.careers.mail.event;

import com.skyzen.careers.mail.entity.MailFolder;

import java.util.UUID;

/**
 * Published (inside the delivery transaction) once per recipient when a message
 * is delivered. A listener fans this out to that account's SSE subscribers AFTER
 * the transaction commits, so the client never re-fetches before the row is
 * visible. {@code folder} is the ACTUAL delivered folder (after inbox rules).
 */
public record MailDeliveredEvent(UUID accountId, MailFolder folder) {
}
