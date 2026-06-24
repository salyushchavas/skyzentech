package com.skyzen.careers.mail.dto;

/** What a matching rule does to the recipient's delivered mailbox entry. */
public enum MailRuleActionType {
    MOVE_TO_FOLDER,
    MARK_READ,
    STAR,
    MARK_IMPORTANT,
    DELETE
}
